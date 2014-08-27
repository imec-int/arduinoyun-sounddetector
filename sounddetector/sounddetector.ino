/* Function prototypes -------------------------------------------------------*/
void readIncommingNodeData();
void checkSoundState(int pin, int level);
void sendSoundState(int pin, int state);
void sendSoundLevel(int pin, int level);
void reportSettings(int pin);

/* Variables -----------------------------------------------------------------*/
#define NodeSerial Serial1 // makes it a little easier to read the code :-) NodeSerial is the serial port that communicates with Node.js, accesible as /dev/ttyATH0 in Linux
//#define NodeSerial Serial // connect directly with laptop (for debugging purposes)

bool debug = false;


uint8_t incomingByte = 0;

const int sampleWindow = 50; // Sample window width in mS (50 mS = 20Hz)
unsigned int sample;

const int statusLedPin = 13; // will light up when the channel settings are received 

const int ledPins[] = {2, 3, 4, 5, 6, 7};
const int soundPins[] = {A5, A4, A3, A2, A1, A0}; // soldered them the wrong way, so they're reversed here

const int pinCount = 6;
int soundValues[] = {0, 0, 0, 0, 0, 0};

unsigned int signalMax[] = {0, 0, 0, 0, 0, 0};
unsigned int signalMin[] = {1024, 1024, 1024, 1024, 1024, 1024};
unsigned long startMillis = millis();


int silenceSampleCounter[] = {0, 0, 0, 0, 0, 0};
int soundSampleCounter[] = {0, 0, 0, 0, 0, 0};

int currentState[] = {0, 0, 0, 0, 0, 0};
int currentSoundState[] = {0, 0, 0, 0, 0, 0};

// settings:
int silenceThreshold[] = {200, 200, 200, 200, 200, 200};
int soundThreshold[] = {300, 300, 300, 300, 300, 300};
int nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence[] = {12, 12, 12, 12, 12, 12};
int nrOfConsecutiveSoundSamplesBeforeFlippingToSound[] = {5, 5, 5, 5, 5, 5};


// monitor settings:
bool enableMonitoring = false;
int channelToMonitor = 0;

// reporting settings:
unsigned long reportingInterval = 10000;
unsigned long lastReportingTime = millis();
int lastReportedPin = pinCount - 1;


/* This function is called once at start up ----------------------------------*/
void setup()
{
  pinMode(statusLedPin, OUTPUT);
  digitalWrite(statusLedPin, 0);
  
  
  for (int pin = 0; pin < pinCount; ++pin) {
    // register every pin as input:
    pinMode(soundPins[pin], INPUT);
    
    // register every led pin as output:
    pinMode(ledPins[pin], OUTPUT);
  }
  
  while (!NodeSerial); //hang till NodeSerial is up
  NodeSerial.begin(9600); //Serial to Node.js
  
  // report all settings (Node.js will reply with the correct settings if they are different):
  for (int pin = 0; pin < pinCount; ++pin) {
    reportSettings(pin);
  }

  if(debug) while (!Serial); //hang till Serial is up
  if(debug) Serial.begin(9600);
}

/* This function loops forever -----------------------------------------------*/
void loop() {
  
  if(millis() - startMillis < sampleWindow) {
    // collecting data:
    
    for (int pin = 0; pin < pinCount; ++pin) {
      sample = analogRead(soundPins[pin]);
      if (sample < 1024) { // toss out spurious readings
         if (sample > signalMax[pin]) {
            signalMax[pin] = sample;  // save just the max levels
         }else if (sample < signalMin[pin]) {
            signalMin[pin] = sample;  // save just the min levels
         }
      }
    }
  }else{
    // we've collected enough data, let's use it
   
    for (int pin = 0; pin < pinCount; ++pin) {
      // store soundValue:      
      soundValues[pin] = signalMax[pin] - signalMin[pin];  // max - min = peak-peak amplitude

      //reset:
      signalMax[pin] = 0;
      signalMin[pin] = 1024;
      startMillis = millis();
      
      // check sound state (SOUND or SILCENCE):
      checkSoundState(pin, soundValues[pin]);
      
      // send sound level (if required):
      if(enableMonitoring && channelToMonitor == pin)
        sendSoundLevel(pin, soundValues[pin]);
    }
  }
  
  readIncommingNodeData();
  
  // reports the settings of every pin (channel) every x milliseconds 
  unsigned long interval = millis() - lastReportingTime;
  if( interval > reportingInterval) {
    int pin = lastReportedPin + 1;
    if(pin == pinCount)
      pin = 0;

    reportSettings(pin);
    
    lastReportedPin = pin;
    lastReportingTime = millis();
  }
}

void checkSoundState(int pin, int level){
  // if(pin != 0) return; //only check pin 0 for now

    
  if( currentState[pin] == 0 ) {
    // IF SILENCE
    
    if(level > soundThreshold[pin]){ // if louder than soundThreshold
      soundSampleCounter[pin]++;
    }else{
      soundSampleCounter[pin] = 0; // reset
    }
    
    if(soundSampleCounter[pin] >= nrOfConsecutiveSoundSamplesBeforeFlippingToSound[pin]){
      currentState[pin] = 1; // flip to "SOUND"
      soundSampleCounter[pin] = 0; // reset soundSampleCounter for the next time there is SILENCE
      
      sendSoundState(pin); // send sound state to Node.js
    }
    
  }else{
    // IF SOUND
    
    if(level < silenceThreshold[pin]){ // if quieter than silenceThreshold
      silenceSampleCounter[pin]++;
    }else{
      silenceSampleCounter[pin] = 0; // reset
    }
    
    if(silenceSampleCounter[pin] >= nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence[pin]){
      currentState[pin] = 0; // flip to "SILENCE"
      silenceSampleCounter[pin] = 0; // reset silenceSampleCounter for the next time there is SOUND

      sendSoundState(pin);
    }
  
  }
}

void sendSoundState(int pin) {
  int state = currentState[pin];
  digitalWrite(ledPins[pin], state); // debug to LED
  
  if(debug) Serial.print("> pin: ");
  if(debug) Serial.print(pin);
  if(debug) Serial.print(" | state: ");
  if(debug) Serial.println(state);
  
  // always start with 3 bytes of 255 so that Node.js knows were this 'packet' starts:
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)1); // 1 = soundstate
  NodeSerial.write((byte)pin); // channel
  NodeSerial.write((byte)state); // volumeon
}

void sendSoundLevel(int pin, int level){  
  // always start with 3 bytes of 255 so that Node.js knows were this 'packet' starts:
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)2); // 2 = soundlevel
  NodeSerial.write((byte)pin);  // channel
  NodeSerial.write((byte)(level >> 8));   // value, first byte (Big Endian)
  NodeSerial.write((byte)(level & 0xff)); // value, last byte  (Big Endian)
}

void reportSettings(int pin) {
  if(debug) Serial.print("Reporting settings of pin ");
  if(debug) Serial.println(pin);
     
  // always start with 3 bytes of 255 so that Node.js knows were a message starts:
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)3);    // 3 = send settings
  NodeSerial.write((byte)pin);  // channel
  NodeSerial.write((byte)(silenceThreshold[pin] >> 8));
  NodeSerial.write((byte)(silenceThreshold[pin] & 0xff));
  NodeSerial.write((byte)(soundThreshold[pin] >> 8));
  NodeSerial.write((byte)(soundThreshold[pin] & 0xff));
  NodeSerial.write((byte)(nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence[pin] >> 8));
  NodeSerial.write((byte)(nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence[pin] & 0xff));
  NodeSerial.write((byte)(nrOfConsecutiveSoundSamplesBeforeFlippingToSound[pin] >> 8));
  NodeSerial.write((byte)(nrOfConsecutiveSoundSamplesBeforeFlippingToSound[pin] & 0xff));
}


int startByteCounter = 0;

void readIncommingNodeData() {
  // READ RESPONSE
  while( NodeSerial.available() ) {
    incomingByte = NodeSerial.read();
    
    if(debug) Serial.print("> incomingByte (expecting 3x255=start of message): ");
    if(debug) Serial.println(incomingByte);

  
    if(incomingByte == 255){
      startByteCounter++;
  
      if(startByteCounter >= 3){
        if(debug) Serial.println("startByteCounter is bigger than 3");
        
        while( !NodeSerial.available() ){ }
        incomingByte = NodeSerial.read();

        
        if(incomingByte == 1) { // enable monitoring
          if(debug) Serial.println("setting enableMonitoring to true");
          enableMonitoring = true;
          
          while( !NodeSerial.available() ){ }
          incomingByte = NodeSerial.read();

          
          channelToMonitor = incomingByte;
          if(debug) Serial.print("set channelToMonitor to ");
          if(debug) Serial.println(channelToMonitor);
          
        }else if(incomingByte == 2) { // disable monitoring
          if(debug) Serial.println("setting enableMonitoring to false");
          enableMonitoring = false;
          
        }else if(incomingByte == 3) { // update settings of channel
          while( !NodeSerial.available() ){ }
          int pin = NodeSerial.read();

          if(debug) Serial.print("incomming settings of pin ");
          if(debug) Serial.println(pin);
          
          digitalWrite(statusLedPin, 1); // turn on after first settings are received
          
          for (int i = 0; i < 4; ++i) {
            uint8_t firstByte;
            uint8_t secondByte;
            
            while( !NodeSerial.available() ){ }
            firstByte = NodeSerial.read();
            
            while( !NodeSerial.available() ){ }
            secondByte = NodeSerial.read();
  
            int value = (firstByte << 8 ) | (secondByte & 0xff);
            
            switch (i) {
              case 0:
                if(debug) Serial.print("silenceThreshold: "); if(debug) Serial.println(value);
                silenceThreshold[pin] = value;
                break;
              case 1:
                if(debug) Serial.print("soundThreshold: "); if(debug) Serial.println(value);
                soundThreshold[pin] = value;
                break;
              case 2:
                if(debug) Serial.print("nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence: "); if(debug) Serial.println(value);
                nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence[pin] = value;
                break;
              case 3:
                if(debug) Serial.print("nrOfConsecutiveSoundSamplesBeforeFlippingToSound: "); if(debug) Serial.println(value);
                nrOfConsecutiveSoundSamplesBeforeFlippingToSound[pin] = value;
                break;
            }// end switch
          }// end for
          
          
          reportSettings(pin); //report settings back to Node, just to make sure they are set
        }
       
        startByteCounter = 0;
      }
      
      
    }else{
      startByteCounter = 0;
    }
  }
}




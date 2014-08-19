/* Function prototypes -------------------------------------------------------*/
void readIncommingNodeData();
void checkSoundState(int pin, int level);
void sendSoundState(int pin, int state);
void sendSoundLevel(int pin, int level);
void turnOffMonitoring();

/* Variables -----------------------------------------------------------------*/
#define NodeSerial Serial1 // makes it a little easier to read the code :-) NodeSerial is the serial port that communicates with Node.js, accesible as /dev/ttyATH0 in Linux
//#define NodeSerial Serial // connect directly with laptop (for debugging purposes)

int incomingByte = 0;

const int sampleWindow = 50; // Sample window width in mS (50 mS = 20Hz)
unsigned int sample;

const int ledPins[] = {2, 3, 4, 5, 6, 7};
const int soundPins[] = {A0, A1, A2, A3, A4, A5};

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



bool debug = true;

/* This function is called once at start up ----------------------------------*/
void setup()
{
  for (int pin = 0; pin < pinCount; ++pin)
  {
    // register every pin as input:
    pinMode(soundPins[pin], INPUT);
    
    // register every led pin as output:
    pinMode(ledPins[pin], OUTPUT);
  }
  
  while (!NodeSerial); //hang till NodeSerial is up
  NodeSerial.begin(9600); //Serial to Node.js

  if(debug) while (!Serial); //hang till Serial is up
  if(debug) Serial.begin(9600);
}

/* This function loops forever -----------------------------------------------*/
void loop() {
  
  if(millis() - startMillis < sampleWindow) {
    // collecting data:
    
    for (int pin = 0; pin < pinCount; ++pin) {
      sample = analogRead(pin);
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
  NodeSerial.write((byte)02); // 02 = soundstate
  NodeSerial.write((byte)pin); // channel
  NodeSerial.write((byte)state); // volumeon
  NodeSerial.write((byte)0); // empty byte, because we always expect 4 bytes ;-)
}



void sendSoundLevel(int pin, int level){  
  uint16_t number = level;
  uint16_t mask   = B11111111;
  uint8_t first_half   = number >> 8;
  uint8_t sencond_half = number & mask;
  
  // always start with 3 bytes of 255 so that Node.js knows were this 'packet' starts:
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)255);
  NodeSerial.write((byte)03); // 03 = soundlevel
  NodeSerial.write((byte)pin);  // channel
  NodeSerial.write((byte)first_half);   // value, first byte (Big Endian)
  NodeSerial.write((byte)sencond_half); // value, last byte  (Big Endian)
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
        
        incomingByte = NodeSerial.read();
        if(debug) Serial.print("> incomingByte: ");
        if(debug) Serial.println(incomingByte);
        
        if(incomingByte == 1) { // enable monitoring
          if(debug) Serial.println("setting enableMonitoring to true");
          enableMonitoring = true;
          
          incomingByte = NodeSerial.read();
          if(debug) Serial.print("> incomingByte: ");
          if(debug) Serial.println(incomingByte);
          
          channelToMonitor = incomingByte;
          if(debug) Serial.print("set channelToMonitor to ");
          if(debug) Serial.println(channelToMonitor);
        }else if(incomingByte == 2) { // disable monitoring
          if(debug) Serial.println("setting enableMonitoring to false");
          enableMonitoring = false;
        }
       
        startByteCounter = 0;
      }
      
      
    }else{
      startByteCounter = 0;
    }
  }
}


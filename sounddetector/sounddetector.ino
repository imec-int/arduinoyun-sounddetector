/* Function prototypes -------------------------------------------------------*/
void readIncommingNodeData();
void checkSoundState(int pin, int level);
void sendSoundState(int pin, int state);
void sendSoundLevel(int pin, int level);

/* Variables -----------------------------------------------------------------*/
#define NodeSerial Serial1 // makes it a little easier to read the code :-) NodeSerial is the serial port that communicates with Node.js, accesible as /dev/ttyATH0 in Linux

int incomingByte = 0;

const int sampleWindow = 50; // Sample window width in mS (50 mS = 20Hz)
unsigned int sample;

const int ledPin = 13;
const int soundPins[] = {A0, A1, A2, A3, A4, A5};

const int pinCount = 6;
int soundValues[pinCount] = {0};

unsigned int signalMax[pinCount] = {0};
unsigned int signalMin[pinCount] = {1024};
unsigned long startMillis = millis();

int silenceThreshold = 800;
int soundThreshold = 930;
int nrOfConsecutiveSilenceSamplesBeforeFlippingToSound = 30;
int nrOfConsecutiveSoundSamplesBeforeFlippingToSilence = 60;
int silenceSampleCounter = 0;
int soundSampleCounter = 0;

int currentState = 0;

int currentSoundState[pinCount] = {0};

bool debug = false;

/* This function is called once at start up ----------------------------------*/
void setup()
{
  pinMode(ledPin, OUTPUT);

  for (int pin = 0; pin < pinCount; ++pin)
  {
    // register every pin as input:
    pinMode(soundPins[pin], INPUT);
  }
  
  while (!NodeSerial); //hang till NodeSerial is up
  NodeSerial.begin(9600); //Serial to Node.js

  if(debug) while (!Serial); //hang till Serial is up
  if(debug) Serial.begin(9600);
}

/* This function loops forever (every 5ms) ------------------------------------*/
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
    // we've collected enough data, lets use it
   
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
      sendSoundLevel(pin, soundValues[pin]);
    }
  }
  
  readIncommingNodeData();
}

void checkSoundState(int pin, int level){
  if(pin != 0) return; //only check pin 0 for now
    
  if( currentState == 0 ) {
    // IF SILENCE
    
    if(level > soundThreshold){ // if louder than soundThreshold
      soundSampleCounter++;
    }else{
      soundSampleCounter = 0; // reset
    }
    
    if(soundSampleCounter >= nrOfConsecutiveSoundSamplesBeforeFlippingToSilence){
      currentState = 1; // flip to "SOUND"
      soundSampleCounter = 0; // reset soundSampleCounter for the next time there is SILENCE
      
      sendSoundState(pin, currentState); // send sound state to Node.js
    }
    
  }else{
    // IF SOUND
    
    if(level < silenceThreshold){ // if quieter than silenceThreshold
      silenceSampleCounter++;
    }else{
      silenceSampleCounter = 0; // reset
    }
    
    if(silenceSampleCounter >= nrOfConsecutiveSilenceSamplesBeforeFlippingToSound){
      currentState = 0; // flip to "SILENCE"
      silenceSampleCounter = 0; // reset silenceSampleCounter for the next time there is SOUND

      sendSoundState(pin, currentState);
    }
  
  }
}

void sendSoundState(int pin, int state) {
  digitalWrite(ledPin, state); // debug to LED
  
  if(debug) Serial.print("> pin: ");
  if(debug) Serial.print(pin);
  if(debug) Serial.print(" | state: ");
  if(debug) Serial.println(state);
  
  // always start with 3 bytes of 255 so that Node.js knows were this 'packet' starts:
  NodeSerial.write(255);
  NodeSerial.write(255);
  NodeSerial.write(255);
  NodeSerial.write(02); // 02 = soundstate
  NodeSerial.write(pin); // channel
  NodeSerial.write(state); // volumeon
  NodeSerial.write(0); // empty byte, because we always expect 4 bytes ;-)
}



void sendSoundLevel(int pin, int level){
  if(pin != 0) return; //debug
  
  
  
  uint16_t number = level;
  uint16_t mask   = B11111111;
  uint8_t first_half   = number >> 8;
  uint8_t sencond_half = number & mask;
  
  // always start with 3 bytes of 255 so that Node.js knows were this 'packet' starts:
  NodeSerial.write(255);
  NodeSerial.write(255);
  NodeSerial.write(255);
  NodeSerial.write(03); // 03 = soundlevel
  NodeSerial.write(pin);  // channel
  NodeSerial.write(first_half);   // value, first byte (Big Endian)
  NodeSerial.write(sencond_half); // value, last byte  (Big Endian)
}






void readIncommingNodeData() {
  // READ RESPONSE
  if( NodeSerial.available() ) {
    // 1. empty incomingByte:
    incomingByte = 0x00;

    // 2. read first byte:
    incomingByte = NodeSerial.read();

    // 3. read the rest of the buffer so that it's empty
    while(NodeSerial.available())
    {
      NodeSerial.read();
    }

    if(incomingByte != 0x00)
    {
      if(debug) Serial.print("> incomingByte:");
      if(debug) Serial.println(incomingByte);
      
      if (incomingByte == 97){ //97='a' in ASCII
        digitalWrite(ledPin, HIGH);
      }else{
        digitalWrite(ledPin, LOW);
      }
    }
  }
}





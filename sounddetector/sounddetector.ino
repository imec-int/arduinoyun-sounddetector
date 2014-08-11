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

const int ledPins[] = {2, 3, 4, 5, 6, 7};
const int soundPins[] = {A0, A1, A2, A3, A4, A5};

const int pinCount = 6;
int soundValues[pinCount] = {0};

unsigned int signalMax[pinCount] = {0};
unsigned int signalMin[pinCount] = {1024};
unsigned long startMillis = millis();

int silenceThreshold[pinCount] = {200};
int soundThreshold[pinCount] = {300};
int nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence[pinCount] = {12};
int nrOfConsecutiveSoundSamplesBeforeFlippingToSound[pinCount] = {5};

int silenceSampleCounter[pinCount] = {0};
int soundSampleCounter[pinCount] = {0};

int currentState[pinCount] = {0};
int currentSoundState[pinCount] = {0};

bool debug = false;

/* This function is called once at start up ----------------------------------*/
void setup()
{
  for (int pin = 0; pin < pinCount; ++pin)
  {
    // register every pin as input:
    pinMode(soundPins[pin], INPUT);
    
    // register every led pin as output:
    pinMode(ledPins[pin], OUTPUT);
    
    while (!Serial);
    Serial.println(nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence[pin]);
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
  if(pin != 0 && pin != 5) return; //only check pin 0 for now
    
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
  NodeSerial.write(255);
  NodeSerial.write(255);
  NodeSerial.write(255);
  NodeSerial.write(02); // 02 = soundstate
  NodeSerial.write(pin); // channel
  NodeSerial.write(state); // volumeon
  NodeSerial.write(0); // empty byte, because we always expect 4 bytes ;-)
}



void sendSoundLevel(int pin, int level){
  return;
  
  
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
        digitalWrite(ledPins[0], HIGH);
      }else{
        digitalWrite(ledPins[0], LOW);
      }
    }
  }
}





/* Function prototypes -------------------------------------------------------*/
void updateState(int pin, int state);
void sendSoundState(int pin, int state);
void readIncommingNodeData();
void sendSoundLevels();
void checkSoundStates();

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

int silenceSamples = 60;
int soundSamples = 60;
int silenceThreshold = 880;
int silenceCapacitor = silenceSamples;
int soundCapacitor = 0;
int soundThreshold = 990;
int currentState = 0;


int threshold = 700; //in mV
int capacity[pinCount] = {0};
int thresholdCapacity[pinCount] = {0};
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
      
      checkSoundStates();
    }
    
    sendSoundLevels(0, soundValues[0]);
 }
}

void checkSoundStates(){
  
  if( currentState == 0 ) {
    //no sound
    if(soundValues[0] > silenceThreshold){ // if louder than silenceThreshold
      silenceCapacitor--;
    }else{
      silenceCapacitor = silenceSamples; // reset capacitor
    }
    
    if(silenceCapacitor <= 0){
      silenceCapacitor = 0; //cap
      currentState = 1; // flip to "there is sound"
      soundCapacitor = soundSamples;
      
      updateState(0, 1);
    }
    
  }else{
    // sound
    
    if(soundValues[0] < soundThreshold){ // if quieter than soundThreshold
      soundCapacitor--;
    }else{
      soundCapacitor = soundSamples; // reset capacitor
    }
    
    if(soundCapacitor <= 0){
      soundCapacitor = 0; //cap
      currentState = 0; // flip to "there is silence"
      silenceCapacitor = silenceSamples;
      
      updateState(0, 0);
    }
    
  }
  
  

}

void updateState(int pin, int state)
{
  // only send state if different from previous:
  if(currentSoundState[pin] != state)
  {
    currentSoundState[pin] = state;

    digitalWrite(ledPin, state); // turn LED on/off

    sendSoundState(pin, state);
  }
}


void sendSoundState(int pin, int state) {
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


void sendSoundLevels(int pin, int level){
//  return;
  
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





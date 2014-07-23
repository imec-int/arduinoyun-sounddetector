/* Function prototypes -------------------------------------------------------*/
void updateState(int pin, int state);
void sendSoundState(int pin, int state);
void readIncommingNodeData();
void sendSoundLevels();

/* Variables -----------------------------------------------------------------*/
#define NodeSerial Serial1 // makes it a little easier to read the code :-) NodeSerial is the serial port that communicates with Node.js, accesible as /dev/ttyATH0 in Linux

int incomingByte = 0;

const int ledPin = 13;
const int soundPins[] = {A0, A1, A2, A3, A4, A5};

const int pinCount = 6;
int soundValues[pinCount] = {0};

int threshold = 700; //in mV
int capacity[pinCount] = {0};
int thresholdCapacity[pinCount] = {0};
int currentSoundState[pinCount] = {0};

bool debug = true;

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
void loop()
{
  for (int pin = 0; pin < pinCount; ++pin)
  {
    soundValues[pin] = analogRead(soundPins[pin]);

    if(soundValues[pin] > threshold)
    {
      thresholdCapacity[pin]++;

      if(thresholdCapacity[pin] >= 3)
      {
        capacity[pin] = 200; //2 seconds
        thresholdCapacity[pin] = 0;

        updateState(pin, 1);
      }
    }
    else
    {
      capacity[pin]--;
      if(capacity[pin] <= 0 ){
        // happens after capacity*(delay+5 ms):
        capacity[pin] = 0; //cap

        updateState(pin, 0);
      }

      thresholdCapacity[pin]--;
      if(thresholdCapacity[pin] <= 0)
      {
        thresholdCapacity[pin] = 0;
      }
    }
  }
  
//  if(debug) Serial.println( soundValues[0] );

  readIncommingNodeData(); // so that the incomming data doesn't block everything
  sendSoundLevels();

  delay(5); // wait an extra 5ms, that's 10ms between loops
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


void sendSoundLevels(){
//  return;
  
  uint16_t number = soundValues[0];
  uint16_t mask   = B11111111;
  uint8_t first_half   = number >> 8;
  uint8_t sencond_half = number & mask;
  
  // always start with 3 bytes of 255 so that Node.js knows were this 'packet' starts:
  NodeSerial.write(255);
  NodeSerial.write(255);
  NodeSerial.write(255);
  NodeSerial.write(03); // 03 = soundlevel
  NodeSerial.write(0);  // channel
  NodeSerial.write(first_half);   // value, first byte (Big Endian)
  NodeSerial.write(sencond_half); // value, last byte  (Big Endian)
}





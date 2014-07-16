int led = 13;
int incomingByte = 0;

void setup() {
  // put your setup code here, to run once:

  Serial.begin(9600);
  Serial1.begin(9600); // internal serial, to Linux /dev/ttyATH0


  pinMode(led, OUTPUT);
}

void loop() {
  // put your main code here, to run repeatedly:

  if (Serial1.available() > 0) {
    incomingByte = Serial.read();

    Serial.print("incomming byte: ");
    Serial.println(incomingByte);

    if (incomingByte == 97){ //97='a' in ASCII
      digitalWrite(led, HIGH);
    }else{
      digitalWrite(led, LOW);
    }
  }
}

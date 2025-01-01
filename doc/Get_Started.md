
# Q:build Get Started Guide

v1.0.0

## Introduction

Q:build is a Micro:bit V2 add-on board that converts a Micro:bit into a device that can be plugged into and works with a Raspberry Pi Build HAT. 
Q:build was designed and tested specifically for Build HAT, but *should* work with other hubs as well. 

Micro:bit has a variety of peripherals on board, including user interfacing devices such as buttons, the LED display and the speaker, 
as well as radio or Bluetooth (BLE) communication, and sensors such as the magnetic and accelerometer sensor. With Q:build, all Micro:bit features and sensor data are available to the application.

In addition, Q:build provides a high-precision gyro sensor for demanding application scenarios, such as when the Micro:bit on-board accelerometer is not sufficient.

Practical requirements vary from application to application, and one Micro:bit firmware program is not enough for all. Therefore, we encapsulated the complex communication details in a MakeCode *extension* to provide a set of easy-to-use APIs. With the Q:build extension, you have the flexibility to customize any functionality or data you need in MakeCode's friendly development environment, using the Blocks or TypeScript language. 


## Overview

It is important to understand the general workings of the Build HAT and some of the internal implementation details.

As an add-on board to the Raspberry Pi SBC, the Build HAT allows applications running on the Raspberry Pi to control LEGO *devices*, such as driving a motor to rotate at a certain speed; or getting data from a device (sensor), e.g. to read the distance between an obstacle in front of it, or to get the current rotational speed and angular position reported by the sensor inside the motor. 
In this sense, Build HAT is a *hub* in LEGO terms.

The application sends control commands to and reads the data returned by the Build HAT via the serial port (UART).
Commands supported by the Build HAT can be found in the official [Raspberry Pi Build HAT Serial Protocol](https://datasheets.raspberrypi.com/build-hat/build-hat-serial-protocol.pdf).

Although Build HAT does not impose any restrictions on the programming language or libraries used by the application, it is generally based on the official [Python library](https://github.com/RaspberryPiFoundation/python-build-hat), which communicates internally with the Build HAT via serial commands.

The above can be illustrated as follows: 

```
                +-----------------------+
                |  Raspberry Pi         |
                |                       |
                |   +---------------+   |
                |   |  Application  |   |
                |   +------^--------+   |
                |          |            |
                |   +------v--------+   |
                |   |  Python Lib   |   |
                |   +------^--------+   |
                +----------|------------+
                           |
                           | Serial (Commands)
                           |
                +----------v------------+
                |      Build HAT        |
                |        (Hub)          |
                +-------^--^--^---------+
                        |  |  | 
                        |  |  | Serial (Messages)
                        |  |  |
          |``````````````  |  ````````````````|
    +-----v----+  +--------v----------+  +----v------+
    |   Motor  |  |  Distance Sensor  |  |  Q:build  |
    | (Device) |  |     (Device)      |  | (Device)  |  ...
    +----------+  +-------------------+  +-----------+
```

Notice that the role of Q:build/Micro:bit is also a device, as with motors, distance sensors... and other Lego devices.

The hub communicates with the devices through a private (non-public) serial protocol, which is based on messages. 
Most of the time we don't need to know the details of this protocol, but, for example, when writing data to a device, we need to organize the messages according to the protocol specification.

The protocol as published by PyBricks can be viewed here: 

https://github.com/pybricks/technical-info/blob/master/uart-protocol.md


### Devices

Each device has a *Device ID* (1 byte, 0 - 0xff), which the hub uses to identify the device type. 
For example, the device ID for the LEGO SPIKE Prime Medium Motor is 0x30, and the device ID for the Color and Distance Sensor is 0x25. The Build HAT serial protocol documentation lists some of the supported device IDs. 

The device's functionality and data is exposed to the hub for access in the form of modes, as described in details in the following section.

Device ID and modes are the most important attributes of a device. In addition to that, there are also a number of less important attributes, such as hardware/firmware versions, which are omitted from this document. 

Q:build provides the `qbuild.setDeviceId()` function to set the device ID, and `qbuild.setModeCount()` to set the number of modes.
Up to 16 modes are supported due to protocol limitations.


### Modes

As mentioned earlier, device functions and data are exposed to hub access (read and write) in the form of *modes*. Each device has one or more
modes, and each mode contains one or more *data items*. A mode can be thought of as a piece of data provided by the device, and that piece of data is composed of an array, with each data item is an element of the array. 

Anyone familiar with the Bluetooth protocol will immediately realize that modes are similar to a Bluetooth device's Characteristics.

Each mode has its own specific *data type*. There are 4 supported data types: int8, int16, int32 and IEEE-754 float. 
All data items of a mode are of the same data type.

Different modes of a device can have different data types and different number of data items.

Take an imaginary Q:build device as an example. The device provides the following modes: 

- Mode 0: represents the Micro:bit accelerometer sensor state, consists of 3 int16 data items, the acceleration in the X/Y/Z direction respectively
- Mode 1: contains just one 1-byte (int8 type) data item, with bit 0 and bit 1 of the byte represent the status of Micro:bit buttons A and B respectively.
When a button is pressed, its corresponding bit is 1.
- Mode 2: contains one byte, allowing values from 0 - 3, representing one of 4 pre-defined tones. When the hub
updates (writes) the mode, Micro:bit will play the corresponding tone

In Q:build, we use functions like `qbuild.setModeName()`, `qbuild.setModeFmt()` and so on to configure the modes. And use `qbuild.getModeData()` and `qbuild.setModeData()` to access the mode data (items).

In addition to the data type and the format of data items, a mode has a number of other attributes that are mainly for presentation purposes and do not affect the primary functionality, e.g. 

- Name
- Unit: e.g. the unit of a distance sensor can be “CM”.
- Range of values 
- Width and number of decimal places 

### Select and Combi

When a device establishes connection with the mub, it begins to *continuously* send data of a selected mode. The hub can change which mode it wants to send at any time through an operation called *select*.
The Build HAT serial command `select`, as its name implies, performs the select operation.

Since the device only sends one mode, what if the application needs to get data for more than one mode in a timely manner? 
The *Combi* is designed for this purpose. A Combi is a combination of data from multiple modes. For example, a Combi can be defined like this: it contains the data items 0, 3, 1 of Mode 3, and the only data item (0) of Mode 0. 

Like a mode, a Combi is referred to by an index number starting from 0. If a mode and a Combi 
share the same index number, the device will send data of the Combi instead of that of the mode. 

The protocol limits the device to a maximum of 8 Combi's (indexes 0 - 7).

With Build HAT, we configure Combi's with the `combi` command.

### Write

The hub can update/modify the data of a mode as long as the device allows it. This is accomplished through a *write* operation. The message format of the write operation between the hub and the device is shown in

https://github.com/pybricks/technical-info/blob/master/uart-protocol.md#writing-data


For Build HAT, the write operation is realized with the `write1` command. Basically, we first construct the message according to the protocol, and then send it to the device with the `write1` command.

The `write1` command and the write operation will be explained in detail later in this document.


## Hello World!

Let's take a look at a very simple program to have some initial experience with the functionality provided by the Q:build extension. 

First, we register two event callback functions that perform some actions when the device establishes connection to and disconnects from the hub (Build HAT): 

```TypeScript
control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_DISCONNECTED, function () {
    basic.showIcon(IconNames.Asleep)
})
control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_CONNECTED, function () {
    basic.showNumber(qbuild.getModeData(0, 0))
})
```

Here, when connection is established between Q:build and Build HAT, the current value of (data item 0 of) Mode 0 is displayed on the LED display.
When the connection is lost, a sleepy face is displayed. 

By default, the Q:build device has 1 mode, which has 1 data item of type int8.

The next step is to decrement or increment the value of Mode 0 when buttons A and B are pressed (and display the updated value on the display): 


```TypeScript
let a = 0
let b = 0

input.onButtonPressed(Button.A, function () {
    a = qbuild.getModeData(0, 0)
    if (a <= 0) {
        return
    }
    a += -1
    qbuild.setModeData(0, 0, a)
    basic.showNumber(a)
})
input.onButtonPressed(Button.B, function () {
    b = qbuild.getModeData(0, 0)
    b += 1
    qbuild.setModeData(0, 0, b)
    basic.showNumber(b)
})
```


All functions of the Q:build extension are defined in the `qbuild` namespace. 

Finally, a few more initialization for the program: 

```TypeScript
qbuild.setModeData(0, 0, 5)
basic.showIcon(IconNames.Asleep)
qbuild.go()
```

We set the initial value of Mode 0 to 5, and display the same image as when it disconnected. At the very end, we call `qbuild.go()`, which tells Q:build to start working in the background, including maintaining connection to the hub and performing select operations, and so on. 

In general, the last statement of a program should always and must be `qbuild.go()`.

Simple enough, right? The full program code is really not that long, and here it is. Copy it into your MakeCode project (main.ts file), download to Micro:bit and run!

```TypeScript
control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_DISCONNECTED, function () {
    basic.showIcon(IconNames.Asleep)
})
control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_CONNECTED, function () {
    basic.showNumber(qbuild.getModeData(0, 0))
})
input.onButtonPressed(Button.A, function () {
    a = qbuild.getModeData(0, 0)
    if (a <= 0) {
        return
    }
    a += -1
    qbuild.setModeData(0, 0, a)
    basic.showNumber(a)
})
input.onButtonPressed(Button.B, function () {
    b = qbuild.getModeData(0, 0)
    b += 1
    qbuild.setModeData(0, 0, b)
    basic.showNumber(b)
})
let b = 0
let a = 0
qbuild.setModeData(0, 0, 5)
basic.showIcon(IconNames.Asleep)
qbuild.go()
basic.forever(function () {
	
})
```

If the Build HAT is already running, connect Q:build to one of the ports, and observe that Micro:bit displays the number 5, indicating that the connection has been successfully established. 

Open the command line interface of the Build HAT with a serial terminal program. Execute the `list` command to see that Q:build has been identified.

```
␊P0: connected to active ID AB␍
␊type AB␍
␊  nmodes =0␍
␊  nview  =0␍
␊  baud   =115200␍
␊  hwver  =10000000␍
␊  swver  =10000000␍
␊  M0 M0 SI = ␍
␊    format count=1 type=0 chars=3 dp=0␍
␊    RAW: 00000000 00000000    PCT: 00000000 00000000    SI: 00000000 00000000␍
␊     speed PID: 00000000 00000000 00000000 00000000␍
␊  position PID: 00000000 00000000 00000000 00000000␍
```

As you can see, the device ID of Q:build is 0xab (the default value); there is one mode, namely “M0”, with data type 0 (int8). 

Execute the `select 0` command to select Mode 0, and Build HAT will continuously print out the value of it, like this:

```
␊P0M0: +5␍
␊P0M0: +5␍
␊P0M0: +5␍
␊P0M0: +5␍
␊P0M0: +5␍
␊P0M0: +5␍
...
```

If the mode value is updated by pressing the Micro:bit buttons, the LED display will show the changed value, and the Build HAT reported value will also change.

To stop printing, execute the `select` command.

Unplug Q:build from the port, and the sleepy emoticon will appear on the LED display (if it is powered through the usb port). 
Re-insert into the port and a number will soon appear, indicating that Q:build has re-established connection.

Q:build supports Combi even if there is only 1 mode. We create a Combi with 2 duplicates of Mode 0 by executing the following command:

```
combi 0 0 0 0 0
```

After the select operation, the Build HAT output will look like this:

```
␊P0C0: +50 +50␍
␊P0C0: +50 +50␍
␊P0C0: +50 +50␍
␊P0C0: +50 +50␍
␊P0C0: +50 +50␍
␊P0C0: +50 +50␍
...
```

Executing `combi 0` (without additional arguments), will “delete” the Combi.

And that's it!

This is a simple but complete Q:build program. With the Q:build extension, it is possible to implement more complex functions, such as defining multiple modes, or modifying mode data. Basically, the only thing that limits us, besides our imagination, are the Micro:bit system resources (CPU power, memory, Flash storage...)!

## Other Topics

This section contains some things that I think are necessary or valuable to elaborate on. 

### `write1` and `write2`

Build HAT provides `write1` and `write2` commands to send raw protocol messages directly to the device.
However, the documentation is very brief, so I'll explain it in detail here. 

The `write1` command is used for messages with only one header, and the `write2` command is used for messages with two headers (INFO messages). 

The command formats are

```
write1 header xx xx xx ...
write2 header header2 xx xx xx ...
```

, where `header` and `header2` are the message headers that do not contain the message length field, which will be set automatically by Build HAT. 
`xx` is a hexadecimal byte (without `0x` prefix), and `xx xx xx ... ` is the complete DATA 
field, **excluding** the checksum byte at the end of the message.

The message length (length of the DATA field) depends on the specific message type. However, any 0 bytes at the end can be omitted, and Build HAT will automatically fill them in as required by the protocol.

For Q:build, we use the `write1` command to send CMD and DATA messages, in order to write mode data. The `write2` command is usually not used.

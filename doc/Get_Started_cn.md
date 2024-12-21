
# Q:build 入门教程

v1.0.0

## 介绍

Q:build 是一个 Micro:bit V2 附件板, 将 Micro:bit 转换为可接入树莓派 Build HAT 的设备. 
Q:build 专门针对 Build HAT 进行设计和测试, 但*应该*也适用于其它 Hub. 

Micro:bit 板载了多种外围设备, 包括按钮, LED 显示屏, 扬声器等用户接口设备, 无线或者蓝牙 (BLE) 通讯,
以及磁场和加速计等传感器. 通过 Q:build, 所有 Micro:bit 功能和传感器数据都能被应用程序所使用.

此外, Q:build 还提供了一颗高精度陀螺仪 (Gyro) 传感器, 用于需求较高的应用场景, 例如, 当 Micro:bit 
板载加速计不敷使用时.

不同应用程序的实际需求各不相同, 一个 Micro:bit 固件程序很难满足所有. 因此, 我们封装了复杂的通讯细节,
以 MakeCode *扩展*的形式提供了一套简单易用的 API. 通过 Q:build 扩展, 在 MakeCode 的友好开发环境中, 
使用 Blocks 或者 TypeScript 语言, 您可灵活定制所需要的任何功能或数据. 

## 概览

有必要先了解一下 Build HAT 的总体工作机制和一些内部实现细节.

作为树莓派单板电脑的附加板, Build HAT 让运行在树莓派上的应用程序可以控制乐高*设备* (Device), 
例如驱动电机/马达 (Motor) 以某一速度转动; 或者从乐高设备 (传感器) 获取数据, 例如, 从距离传感器 (Distance sensor) 
读取与前方障碍物之间的距离, 或者获得电机内部传感器报告的当前转速和角度位置. 从这种意义上来说, 
按照乐高圈子的术语, Build HAT 就是一个 *Hub*.

应用程序通过串口 (Serial/UART) 向 Build HAT 发送控制命令 (Commands), 并读取 Build HAT 返回的数据. 
Build HAT 所支持的命令见官方串口协议文档 [Raspberry Pi Build HAT Serial Protocol](https://datasheets.raspberrypi.com/build-hat/build-hat-serial-protocol.pdf). 

尽管 Build HAT 本身并不限制应用程序使用的编程语言或者库, 但一般都会基于官方的 [Python 库](https://github.com/RaspberryPiFoundation/python-build-hat)
进行开发. Python 库内部通过串口命令的方式与 Build HAT 进行通讯.

以上所述图示如下: 

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

注意到, Q:build/Micro:bit 的角色也是设备, 如同电机, 距离传感器...等乐高设备一样.

Hub 与设备之间也是通过串口进行通讯, 是一种基于消息 (Message) 的私有 (不公开的) 协议. 
大部分情况下我们不需要了解这个协议的具体内容, 但是, 例如, 当需要向设备写数据时, 就要按照协议的定义来组织发送给设备的消息.
PyBricks 所公布的协议内容可以在这里查看:

https://github.com/pybricks/technical-info/blob/master/uart-protocol.md


### 设备

每种设备有一个*设备 ID* (1 字节, 0 - 0xff), Hub 用以识别设备类型. 例如, 乐高 SPIKE Prime 
中型马达的设备 ID 是 0x30, 颜色和距离传感器的设备 ID 是 0x25. Build HAT 串口协议文档中列出了支持的部分设备 
ID.

设备的功能和数据以 Mode 的形式暴露给 Hub 访问, 下节详述.

设备 ID 和 Mode 是设备最重要的属性. 除此以外, 还有一些重要性相对较低的属性, 如硬件/固件版本等, 
本文从略.


### Mode

如前所述, 设备的功能和数据以 *Mode* (模式) 的形式暴露给 Hub 访问 (读和写). 每个设备有 1 个或多个
Mode, 每个 Mode 又包含 1 个或者多个*数据项*. 可以将每个 Mode 理解为该设备提供的一条数据, 
而每个 Mode 的构成相当于一个数组, 每个数据项就是一个数组元素. 

对蓝牙协议有了解的人马上就会意识到, Mode 与蓝牙设备的 Characteristic 相似.

每个 Mode 有其特定的*数据类型*. 支持的数据类型有 4 种: int8, int16, int32 和 IEEE-754 float. 
一个 Mode 的所有数据项是同一数据类型.

一个设备的不同 Mode 可以是不同的数据类型, 也可以有不同的数据项个数.

以一个虚构的 Q:build 设备为例. 该设备提供以下几个 Mode: 

- Mode 0: 代表 Micro:bit 的加速计传感器状态, 由 3 个 int16 数据项构成, 分别是 X/Y/Z 轴方向的加速度
- Mode 1: 仅包含一个 1 字节 (int8 类型) 的数据项, 字节的 bit 0, bit 1 分别代表 Micro:bit
按钮 A 和 B 的状态; 当某一按钮被按下, 它对应的位为 1
- Mode 2: 仅包含一个 1 字节的数据项, 允许的取值范围为 0 - 3, 代表预先定义的 4 个音频. 当 Hub
更新 (写) 此 Mode 的值时, Micro:bit 将播放对应的音频

除了数据类型和数据项个数, Mode 还有一些其它属性, 主要用于展示, 不影响主要功能, 例如: 

- 名称
- 单位: 例如距离传感器的单位可为 "CM"
- 取值范围 
- 宽度和小数位数 


### Select 和 Combi

当设备与 Hub 建立连接后, 开始*持续*发送某一选定的 Mode 的数据. Hub 可通过称为 Select 的操作随时改变要发送哪个 Mode.
Build HAT 串口命令 `select`, 如同它的名字所暗示的, 正是执行 Select 操作.

由于设备只发送一个 Mode, 如果应用程序需要及时获取多个 Mode 的数据, 那该怎么办呢? 为此设计了一个叫做 Combi
的概念. 一个 Combi 是多个 Mode 的数据的组合. 例如可以这样定义一个 Combi: 它包含 Mode 3 的数据项 0, 3, 1
以及 Mode 0 唯一的的数据项 (0). 

如同 Mode 一样, Combi 也是使用一个从 0 开始的索引号来指代. 如果一个 Mode 和一个 Combi 
是同一个索引号, 当 Select 选定这个索引号时, 设备将发送 Combi 而不是 Mode 的数据.

通讯协议限定了设备最多有 8 个 Combi (索引 0 - 7).

Build HAT 通过 `combi` 命令配置 Combi.


### Write

只要设备端允许, Hub 可以更新/修改某一 Mode 的数据. 这是通过 Write 操作来实现的. Hub 和设备之间的
Write 操作的消息格式见

https://github.com/pybricks/technical-info/blob/master/uart-protocol.md#writing-data

对于 Build HAT, Write 操作是以 `write1` 命令来实现的. 基本上, 我们要首先按照设备协议构造出消息,
再通过 `write1` 命令将消息发送给设备.

关于 `write1` 命令及 Write 操作, 本文后面还将详细说明.


## Hello World!

下面我们通过一个最简单的程序来认识 Q:build 扩展所提供的功能. 首先注册 2 个事件回调函数, 在设备与
Hub (Build HAT) 建立和断开连接时分别执行预定的动作: 

```TypeScript
control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_DISCONNECTED, function () {
    basic.showIcon(IconNames.Asleep)
})
control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_CONNECTED, function () {
    basic.showNumber(qbuild.getModeData(0, 0))
})
```

这里, 当 Q:build 与 Build HAT 之间建立连接时, 将 Mode 0 的数据项 0 的当前值显示在 LED 屏上.
而当连接断开时, 则显示一个犯困的表情. 

默认地, Q:build 设备共有 1 个 Mode, 该 Mode 有 1 项 int8 类型数据.

接下来实现的是, 当按钮 A 和 B 被按下时, 分别递减或递增 Mode 0 的值 (同时也将更改后的值显示在 LED 屏幕上): 

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

Q:build 扩展的所有函数都定义在 `qbuild` 命名空间内. 

最后是程序的其它初始化动作: 

```TypeScript
qbuild.setModeData(0, 0, 5)
basic.showIcon(IconNames.Asleep)
qbuild.go()
```

我们把 Mode 0 初始值设为 5, 并在 LED 屏上显示跟断开连接时相同的图案. 最后调用 `qbuild.go()`, 
让 Q:build 开始在后台工作, 包括维护与 Hub 之间的连接, 执行 Select 操作等等. 

一般来说, 程序的最后一条语句应该始终且必须是 `qbuild.go()`.

很简单对吧? 程序代码的确不长, 完整地放在这里. 把它拷贝到 MakeCode 项目中 (main.ts 文件), 下载到 Micro:bit 运行: 

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

如果 Build HAT 已经在正常运行了, 把 Q:build 连接到 Build HAT 某一端口, 将会观察到 Micro:bit
LED 屏上显示的表情变成数字 5, 这说明已经成功地建立了连接. 用串口终端程序打开 Build HAT 的命令行界面, 
执行 `list` 命令, 可以看到 Q:build 识别信息:

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

可以看到, Q:build 的设备 ID 是 0xab (默认值); 有一个 Mode, 名称为 "M0", 数据类型是 0 (int8). 

执行 `select 0` 命令以选定 Mode 0, Build HAT 将会持续打印出 Mode 0 的值:

```
␊P0M0: +5␍
␊P0M0: +5␍
␊P0M0: +5␍
␊P0M0: +5␍
␊P0M0: +5␍
␊P0M0: +5␍
...
```

通过 Micro:bit 按钮修改 Mode 数值, Micro:bit LED 屏上将会显示修改后的值, 同时 Build HAT 
报告的值亦随之改变.

如果想要停止打印, 执行 `select` 命令.

把 Q:build 从 Build HAT 端口拔出, Micro:bit LED 屏上将会显示表情图案 (如果同时通过 USB 供电的话). 重新插入端口, 很快就会显示数字,
表示 Q:build 已再次建立了连接. 

这就是一个简单不过然而完整的 Q:build 程序! 通过 Q:build API, 可以实现更加复杂的功能, 比如定义多个 Mode, 
或者支持修改 Mode 数据. 基本上, 限制我们的除了想象力, 就只剩下 Micro:bit 的系统资源 (CPU, 内存, Flash 存储空间...)!


## 其它话题

本节包含一些我认为有必要或者有价值加以说明的东西. 

### `write1` 及 `write2`

Build HAT 提供了 `write1` 和 `write2` 命令, 用于直接向设备发送原始协议消息, 但是文档中没有说明这
2 个命令的用法, 我这里补出.

`write1` 用于只有 1 个 header (消息头) 的消息, 而 `write2` 用于有 2 个 header 的消息 (INFO 消息). 
命令格式是:

```
write1 header xx xx xx ...
write2 header header2 xx xx xx ...
```

其中, `header` 和 `header2` 是消息 header. `xx` 为十六进制字节 (无 `0x` 前缀), `xx xx xx ...` 是消息的完整 DATA 
字段, **不**含消息末尾的校验字节.

DATA 字段的长度取决于具体的消息类型. 但是末尾的 0 字节可以省略, Build HAT 会自动根据协议要求补足.

对于 Q:build 而言, 我们使用 `write1` 命令来发送 CMD 消息和 DATA 消息, 以向设备写 Mode. 
`write2` 一般用不到.


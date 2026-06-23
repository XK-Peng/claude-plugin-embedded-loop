# 工具链命令模板（env-resolver 参考）

> 这些是**规范模板**,不是某台机器上的最终命令。占位符:`${PROJECT}` 工程/目标名、
> `${ARTIFACT}` 产物(.bin/.hex/.elf)、`${PORT}` 串口、`${ADDR}` 烧写起始地址。
> 路径、接口(SWD/SWS/DFU)、起始地址因板而异 —— **生成后必须让用户确认**。
> OS 影响:Windows 串口 `COMx`、路径反斜杠;Linux/macOS `/dev/ttyUSB*`、`/dev/tty.*`。

## Telink TLSR82xx（如 TLSR8208D）
- IDE/SDK:Telink IDE(Eclipse) 或命令行 make;编译器 `tc32-elf-gcc`(Telink 定制 GCC)。
- 编译(示例):`make -C ${PROJECT}`（SDK 自带 makefile,产出 `*.bin`）
- 烧录:Telink BDT(Burning & Debugging Tool)多为 GUI;命令行烧录走 SWS 单线,
  视你装的烧录器/脚本而定 → **此项通常需用户给实际命令**(BDT 命令行 / 厂商 burner / USB dongle)。
- 串口监控:DUT 调试串口 `COMx @ 115200`。
- 备注:寄存器/管脚以 `docsDir` 下 TLSR8208D datasheet + SDK board.h 为准,不臆测。

## STM32 + STM32CubeIDE / STM32CubeCLT
- 编译:CubeIDE 生成 Makefile → `make -j`(产出 `${PROJECT}.elf/.bin/.hex`)
- 烧录(SWD,ST-Link):
  `STM32_Programmer_CLI -c port=SWD -w ${ARTIFACT} -v -rst`
  (UART bootloader:`-c port=${PORT}`;DFU:`-c port=USB1`;起始地址写 .bin 时加 `${ADDR}`,常见 `0x08000000`)
- 跨平台:STM32_Programmer_CLI 在 Windows/Linux/macOS 都有。

## STM32 + Keil MDK (uVision)
- 编译(命令行):`UV4 -b ${PROJECT}.uvprojx -j0 -o build.log`
- 烧录:`UV4 -f ${PROJECT}.uvprojx` 或用 `STM32_Programmer_CLI`/`st-flash` 烧 .bin/.hex。
- 仅 Windows。

## STM32 + 通用 GCC + st-flash(开源)
- 编译:`make`（arm-none-eabi-gcc 产出 .bin）
- 烧录:`st-flash write ${ARTIFACT} ${ADDR}`（常见 `0x08000000`）

## nRF5 / Nordic + Zephyr(west)
- 编译:`west build -b ${BOARD} ${PROJECT}`
- 烧录:`west flash`（runner 可选 `--runner jlink|nrfjprog|pyocd|openocd`）
- 直接用 nrfjprog:`nrfjprog --program ${ARTIFACT}.hex --chiperase --verify -r`

## ESP32 / ESP-IDF
- 编译:`idf.py build`
- 烧录+监控:`idf.py -p ${PORT} flash monitor`
- 仅烧录:`esptool.py -p ${PORT} write_flash ${ADDR} ${ARTIFACT}.bin`

## IAR EWARM
- 编译:`iarbuild ${PROJECT}.ewp -build ${CONFIG}`
- 烧录:经 I-jet/CLI 或导出 .hex 后用对应厂商烧录工具。

## Arduino / arduino-cli
- 编译:`arduino-cli compile --fqbn ${FQBN} ${PROJECT}`
- 烧录:`arduino-cli upload -p ${PORT} --fqbn ${FQBN} ${PROJECT}`

## AVR(裸)
- 编译:`avr-gcc ... -o ${ARTIFACT}.elf && avr-objcopy -O ihex ...`
- 烧录:`avrdude -c ${PROGRAMMER} -p ${MCU} -U flash:w:${ARTIFACT}.hex`

## 主机侧单元测试(host,任意芯片通用)
- 因为架构是 HAL/BSP + 函数指针 ops,逻辑层可在 PC 编译运行:
  `gcc -I include test/*.c src/logic/*.c -o ut && ./ut`（Windows: MinGW `gcc`,产出 `ut.exe`)
- 填进 board profile 的 `host_test.command`,逻辑层不上板即可秒级回归。

## Nations 国民技术（N32Gxx / N32Lxx，如 N32G003，Cortex-M0/M0+）
- IDE：Keil MDK，配 Nations 的 DFP 包（如 `Nations.N32G003_DFP.x.x.x.pack`）+ 厂商固件库（`Nations.N32G003_Library`）。
- 编译：Keil 命令行 `UV4 -j0 -b <工程.uvprojx> -o keil_build.log`（工程在 SDK 的 projects/.../ 下）。
- 烧录：常用 **J-Link**（SDK 自带 jlink/ 目录即提示）。
  - 最稳：Keil 自带下载 `UV4 -f <工程.uvprojx>`（用工程里配的 J-Link + DFP flash 算法）。
  - 或 J-Link CLI：`JLink.exe -device <N32器件名> -if SWD -speed 4000 -CommanderScript flash.jlink`（器件名以 J-Link 设备列表为准，待确认）。
- 寄存器/管脚以资料夹下的 datasheet/DFP/固件库 board 文件为准，不臆测。

## 通用兜底（厂商不在上表 / 私有内核，如 Telink tc32、各家 RISC-V）
1. 让 detect-env 先扫出芯片/IDE/烧录器线索，能扫到就生成 board 草稿。
2. 扫不准时，直接请用户给**一条平时能编译通过的命令**和**一条能烧录的命令**，原样填进 board profile 的 build/flash。
3. 不要硬套相近厂商的工具（如别拿 ST 的 STM32CubeProgrammer 去烧非 ST 芯片）。

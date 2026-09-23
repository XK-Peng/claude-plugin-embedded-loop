# 构建系统通用命令形态（按构建系统，不按芯片）

> 占位：`<proj>` 工程文件、`<out>` 产物、`<port>` 串口、`<addr>` 烧写地址。
> 这里只放构建系统本身的通用用法；具体芯片/工程跑通的组合沉淀在经验库里（scope=toolchain/buildSystem）。

## keil-uvision（.uvprojx / .uvproj）
- 编译：`UV4.exe -j0 -b <proj> -o <log>`；重建用 `-r`
- 下载：`UV4.exe -j0 -f <proj> -o <log>`（使用工程里配置的调试器与 flash 算法，与器件无关）
- 退出码：0 无错无警告，1 仅警告，2 有错误，3 致命错误，11 打不开工程，12 器件不在数据库（缺 DFP 包）
- 产物：`<OutputDirectory>/<OutputName>.hex|.axf`（probe 已从工程里读出）
- WSL 下可直接调用 Windows 的 UV4.exe（路径形如 `/mnt/c/...`），工程路径需是 Windows 可访问的路径

## iar-ewarm（.ewp）
- 编译：`iarbuild <proj>.ewp -build <config>`
- 下载：IAR 的 cspybat，或导出 hex 后用调试器厂商工具

## cmake / make + GCC 交叉工具链
- 编译：`cmake -S . -B build && cmake --build build` / `make -j`
- 产物转换：`<prefix>objcopy -O ihex <elf> <hex>`
- 下载（按调试器，不按芯片）：
  - J-Link：`JLink.exe -device <器件名> -if SWD -speed 4000 -CommanderScript <script>`（器件名以 J-Link 支持列表为准）
  - OpenOCD：`openocd -f interface/<adapter>.cfg -f target/<target>.cfg -c "program <out> verify reset exit"`
  - pyOCD：`pyocd flash -t <target> <out>`（可用 CMSIS pack：`--pack <pack>`）

## esp-idf
- `idf.py build` / `idf.py -p <port> flash monitor`

## zephyr-west
- `west build -b <board>` / `west flash`（runner 可选）

## platformio
- `pio run` / `pio run -t upload` / `pio device monitor`

## eclipse-cdt 系 IDE（厂商定制 Eclipse）
- 无头构建：`<ide可执行> -nosplash -application org.eclipse.cdt.managedbuilder.core.headlessbuild -data <workspace> -build <project>/<config>`
- 更稳的做法：从 IDE 的构建控制台抄出实际调用的编译器命令，改写成 make/脚本

## 通用兜底
识别不出构建系统，或是模组 SDK / 私有工具链：请用户给一条能跑通的编译命令与烧录命令，原样写入 board profile；跑通后按 lesson-loop 入库。

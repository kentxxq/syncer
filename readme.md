# syncer-temp

An Electron application with Vue and TypeScript

## target

我计划使用 electron 来编写一个 files 管理工具。使用 electron-vite + vue3

1. 类似 dotbot，同步.zshrc ，agents.md 之类的文件。
2. 支持模板语法，支持全局变量，可以从当前系统获取各种变量信息。也就是说每次同步文件的时候，把文件内容渲染以后再同步到目标位置。
3. 集成 Monaco Editor ，可以让我编辑源文件，预览只读最终文件。支持 diff 对比
4. 不要用软硬链接，直接用文件。
5. 需要对 AI 友好。所有的设置，关联，都是基于配置文件的。AI 可以直接生成配置文件。然后工具通过反向读取配置文件，显示 UI 内容

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

# 闲鱼机会雷达

面向闲鱼卖家的轻量选品 Chrome 扩展 MVP。它把需求、竞争、利润、交付和合规风险放进一张机会卡，帮助用户先验证，再上架。

## 本地开发

```bash
pnpm install
pnpm dev
```

WXT 会生成 `.output/chrome-mv3-dev`。在 Chrome 打开 `chrome://extensions`，启用开发者模式并选择“加载已解压的扩展程序”。开发进程运行期间，代码修改会自动热更新。

## 质量检查

```bash
pnpm check
pnpm zip
```

`check` 会依次执行类型检查、单元测试和生产构建。扩展安装包输出在 `.output`。

## 隐私与权限

- 数据默认保存在浏览器本地，不上传用户输入。
- 仅申请 `storage`、`sidePanel` 和闲鱼站点访问权限。
- 不使用远程脚本、`eval` 或动态代码执行。
- 在线演示仅用于体验界面，完整页面伴随能力需加载 Chrome 扩展。


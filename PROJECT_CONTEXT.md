# 个人视觉作品集项目上下文

## 项目位置

`O:\\project-personal-creative-portfolio-website-build`

GitHub：`yellow1999-sex/personal-creative-portfolio`

正式网站：`https://personal-creative-portfolio-theta.vercel.app`

## 网站定位

个人视觉作品集网站，包含完整作品、场景包预设、提示词库、工作流分享、联系页。

## 当前页面

- `/`：首页，带视频背景、作品循环、BGM、联系场景。
- `/works`：场景包预设，包含大合成、半合成 X 立绘还原、场照半合成预制菜。
- `/prompts`：提示词库，支持分类、搜索、预览和复制。
- `/workflow`：工作流分享入口。
- `/workflow/semi-composite`：comfyui 工作流分享详情页。

## 最近完成的功能

- 联系页已加入 QQ 群二维码。
- 首页导航已加入头像。
- 首页有原创缓慢钢琴 BGM。
- 完整作品、提示词库、工作流页面使用视频背景。
- 工作流首页窗口为透明卡片。
- `/works` 第三类已改为“场照半合成预制菜”，共 20 个 16:9 窗口。
- 作品页有 BLACK 感谢贺卡，点击可查看高清完整图片和感谢文字。
- ComfyUI 详情页已移除顶部横幅，使用 8 个 3:4 图片窗口。
- 8 个 ComfyUI 图片按图片文件名逐一对应功能名称和数字。
- 详情卡右下角按钮文字为“复制完整工作流代码到插件添加”。

## 重要资源位置

- 感谢卡：`public/images/thanks/black-profile.png`
- ComfyUI 图片：`public/images/workflow/comfyui/01.png` 至 `08.png`
- 页面数据：`src/config.ts`
- 工作流数据：`src/workflowConfig.ts`
- 作品页：`src/pages/PortfolioPage.tsx`
- 工作流页：`src/pages/WorkflowPage.tsx`
- 全局样式：`src/styles.css`

## 编辑规则

- 修改前先读取当前代码，不要假设旧聊天内容仍然准确。
- 一次只处理一个明确功能，不顺手改无关页面。
- 不删除已有图片、视频、提示词或用户修改，除非明确要求。
- 图片、标题、数字、提示词或复制内容必须保持一一对应。
- 约束类提示词必须使用“严格保持 XXX 不变”这类明确限制。
- 修改后运行 `npm.cmd run build`。
- 用户明确要求上线时，提交并推送 GitHub；Vercel 会自动部署。

## 新任务模板

新窗口可以直接发送：

> 请先读取项目根目录的 `PROJECT_CONTEXT.md`，再检查当前代码。
> 本次只处理：____。
> 目标页面：____。
> 需要保留：____。
> 不要修改：____。
> 完成后运行构建验证；除非我明确要求，不要提交或部署。


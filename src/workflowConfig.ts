import { imageConfig } from './config'

export type WorkflowStep = {
  id: string
  title: string
  image: string
  summary: string
  prompt: string
}

export type WorkflowModule = {
  slug: string
  title: string
  cover: string
  steps: WorkflowStep[]
}

const black = imageConfig.placeholders.black
const white = imageConfig.placeholders.white

type WorkflowStepSeed = {
  title: string
  summary: string
  prompt: string
  image?: string
}

const steps = (items: WorkflowStepSeed[]): WorkflowStep[] => items.map((item, index) => ({
  id: String(index + 1).padStart(2, '0'),
  title: item.title,
  summary: item.summary,
  prompt: item.prompt,
  image: item.image || (index % 4 === 0 ? white : black),
}))

/** 工作流页面唯一内容入口，后续可直接替换封面、步骤图片与标题。 */
export const workflowModules: WorkflowModule[] = [
  {
    slug: 'composite',
    title: '无思路快速合成分享',
    cover: black,
    steps: steps([
      {
        title: '确定画面',
        summary: '先明确主体、镜头和叙事重点，为后续合成留出稳定的构图空间。',
        prompt: '电影感大合成构图，主体清晰突出，前中后景层次分明，保留呼吸感留白，广角镜头，统一视觉焦点，细腻质感，适合后期继续合成。',
      },
      {
        title: '选择素材',
        summary: '筛选轮廓、视角和光线接近的素材，降低后期修补成本。',
        prompt: '高质感合成素材组，人物与环境视角一致，轮廓干净，材质细节自然，光线方向统一，保留真实摄影颗粒和空间关系。',
      },
      {
        title: '匹配透视',
        summary: '通过地平线、消失点和比例关系，让主体真正进入场景。',
        prompt: '真实摄影透视关系，主体比例准确，消失点统一，地面接触自然，空间纵深明确，避免漂浮和比例失真，电影画幅构图。',
      },
      {
        title: '统一光影',
        summary: '补齐接触阴影、轮廓光和环境反射，建立同一时空的光照逻辑。',
        prompt: '统一环境光影，柔和主光从左前方进入，主体边缘有克制轮廓光，接触阴影自然，反射色与背景协调，保留真实摄影明暗过渡。',
      },
      {
        title: '塑造颜色',
        summary: '用主色、辅助色和局部对比控制画面的情绪与视觉秩序。',
        prompt: '高级电影调色，低饱和冷暖对比，肤色与材质保持自然，暗部有层次，高光不过曝，整体氛围统一，细节清晰，质感克制。',
      },
      {
        title: '最终检查',
        summary: '放大检查边缘、噪点和细节，再统一输出尺寸与色彩空间。',
        prompt: '最终合成检查，边缘干净无抠图痕迹，细节锐度均衡，噪点颗粒统一，颜色过渡自然，画面完整稳定，适合高分辨率发布。',
      },
    ]),
  },
  {
    slug: 'semi-composite',
    title: 'comfyui工作流分享',
    cover: white,
    steps: steps([
      {
        title: '分析立绘',
        summary: '先拆分人物结构、服装材质和原始光线，再决定画面方向。',
        prompt: '二次元立绘还原分析，保留人物五官与服装结构，明确镜头角度和姿态，建立清晰的光影参考，画面干净，细节可控。',
      },
      {
        title: '清理主体',
        summary: '修整边缘与遮挡关系，让人物轮廓在新场景中保持完整。',
        prompt: '干净的人物主体抠取，发丝和衣物边缘自然，去除杂色与残留背景，保留细小材质细节，轮廓清晰，适合继续合成。',
      },
      {
        title: '建立背景',
        summary: '先搭建简洁空间，再用材质和景深确定人物所处的氛围。',
        prompt: '幻想感场景背景，空间层次清楚，材质细腻，色彩与人物服装协调，适度景深和空气透视，保持主体为视觉中心。',
      },
      {
        title: '衔接光影',
        summary: '为人物补充来自背景的色光与投影，消除贴图感。',
        prompt: '人物与场景光影融合，环境色光轻微映射到衣物和发丝，脚下有自然投影，明暗方向一致，保留立绘线条和质感。',
      },
      {
        title: '强化氛围',
        summary: '用雾气、粒子和局部高光增加空间感，但不遮挡主体信息。',
        prompt: '轻微薄雾与细小光尘，层次柔和，局部高光点缀，氛围梦幻但不过度，主体边缘清楚，画面保持高级留白。',
      },
      {
        title: '导出复盘',
        summary: '记录有效参数和失败尝试，方便下一张立绘快速复用。',
        prompt: '立绘合成最终输出，人物比例稳定，线条清晰，颜色统一，细节完整，适合竖屏展示和后续继续调整，保留可复用图层逻辑。',
      },
      {
        title: 'ComfyUI节点整理',
        summary: '按加载模型、采样、放大和保存结果整理节点，保持连线清晰。',
        prompt: 'ComfyUI工作流节点整理：加载模型、加载参考图、正负面提示词、采样器、潜空间放大、图像放大、细节修复、保存图像。节点命名清楚，连线方向统一，保留可复用参数，输出稳定的场照半合成结果。',
      },
      {
        title: '工作流代码分享',
        summary: '整理可直接导入的工作流代码，复制后即可在 ComfyUI 中继续修改。',
        prompt: '请输出完整可导入的 ComfyUI 工作流 JSON 代码，包含模型加载、参考图输入、采样、放大、细节修复和保存节点；节点连接完整，参数使用明确数值，代码格式合法，不省略任何节点或连线。',
      },
    ]),
  },
  {
    slug: 'free-ps',
    title: '免费PS创成小香蕉分享',
    cover: black,
    steps: steps([
      {
        title: '准备环境',
        summary: '整理文件夹、画布尺寸和素材命名，减少操作过程中的来回查找。',
        prompt: '清晰的后期制作工作区，文件结构整洁，画布比例准确，素材分层明确，界面干净，适合新手跟着步骤完成合成。',
      },
      {
        title: '免费工具',
        summary: '从免费可用的抠图、放大和调色工具开始，先解决最常用的问题。',
        prompt: '免费图像处理工具组合，抠图边缘自然，放大细节稳定，色彩校正准确，操作步骤清晰，适合个人创作者长期使用。',
      },
      {
        title: '基础操作',
        summary: '掌握图层、蒙版、选区和调整图层四个核心动作。',
        prompt: '新手友好的图像编辑流程，图层结构清楚，蒙版边缘干净，选区过渡自然，调整图层可回退，保持画面细节和色彩稳定。',
      },
      {
        title: '小香蕉实操',
        summary: '用一个完整案例演示从素材导入到最终出片的连续操作。',
        prompt: '可复刻的小香蕉合成案例，主体突出，背景简洁，光影自然，色彩明快，步骤完整，适合跟随练习并替换成自己的素材。',
      },
      {
        title: '整理结果',
        summary: '导出前统一检查尺寸、锐度和文件格式，保留可修改源文件。',
        prompt: '后期作品整理与导出，画面清晰，颜色稳定，边缘无瑕疵，文件命名规范，同时保留分层源文件与发布用成片。',
      },
      {
        title: '常见问题',
        summary: '汇总边缘发灰、颜色不统一和画面发糊等常见问题的处理方式。',
        prompt: '后期合成问题排查，修复边缘发灰、光影不一致、颜色偏移和细节模糊，步骤简单明确，保持自然真实的最终效果。',
      },
    ]),
  },
]

export const getWorkflowModule = (slug: string | undefined) => (
  workflowModules.find((module) => module.slug === slug)
)

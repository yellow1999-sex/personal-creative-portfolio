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
        title: 'Krea2图生图一致性', summary: '', prompt: '2079780529599238146', image: '/images/workflow/comfyui/01.png',
      },
      {
        title: 'MJ审美之王', summary: '', prompt: '2079780529599238146', image: '/images/workflow/comfyui/02.png',
      },
      {
        title: '超级大礼包', summary: '', prompt: '2023976779043311618', image: '/images/workflow/comfyui/03.png',
      },
      {
        title: '超清放大', summary: '', prompt: '2062492774783610882', image: '/images/workflow/comfyui/04.png',
      },
      {
        title: '韩式磨皮修脸', summary: '', prompt: '2072869891509669890', image: '/images/workflow/comfyui/05.png',
      },
      {
        title: '究极抠图', summary: '', prompt: '2044018179520864257', image: '/images/workflow/comfyui/06.png',
      },
      {
        title: '双图编辑 低色差，无偏移，宽审核', summary: '', prompt: '2072190882207584257', image: '/images/workflow/comfyui/07.png',
      },
      {
        title: '照片级写实渲染', summary: '', prompt: '2013570680079523842', image: '/images/workflow/comfyui/08.png',
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

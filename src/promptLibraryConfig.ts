import { imageConfig } from './config'

export type PromptLibraryCategoryId = 'portrait' | 'scene' | 'effect' | 'outfit' | 'universal'

export type PromptLibraryCategory = {
  id: PromptLibraryCategoryId
  label: string
}

export type PromptLibraryItem = {
  id: string
  category: PromptLibraryCategoryId
  title: string
  image: string
  tags: string[]
  prompt: string
  params: string
}

export const promptLibraryCategories: PromptLibraryCategory[] = [
  { id: 'portrait', label: '人像' },
  { id: 'scene', label: '场景' },
  { id: 'effect', label: '特效' },
  { id: 'outfit', label: '衣服' },
  { id: 'universal', label: '通用' },
]

const BLACK = imageConfig.placeholders.black
const WHITE = imageConfig.placeholders.white

/**
 * 提示词库唯一内容入口。后续新增卡片时继续添加对象即可，分类数量、搜索结果与计数会自动更新。
 * 把 image 改成 public/images/ 下的图片地址，例如 `/images/prompts/portrait-01.webp`。
 */
export const promptLibraryItems: PromptLibraryItem[] = [
  {
    id: 'portrait-01',
    category: 'portrait',
    title: '真实肤质精修',
    image: BLACK,
    tags: ['肤质', '自然光'],
    prompt: '高质量 COS 人像精修，保留真实皮肤纹理与细微毛孔，清理暂时性瑕疵，眼神清晰自然，面部明暗过渡柔和，肤色统一但不过度磨皮，发丝边缘干净，真实摄影质感，避免塑料皮肤、锐化光圈和失真五官。',
    params: '中近景 / 纹理保留 / 低锐化',
  },
  {
    id: 'portrait-02',
    category: 'portrait',
    title: '冷暖轮廓光',
    image: WHITE,
    tags: ['轮廓光', '冷暖'],
    prompt: '电影感 COS 半身肖像，面部由柔和暖色主光照亮，发丝与肩部带细窄冷色轮廓光，背景低饱和深灰绿，眼神光克制，皮肤保持真实细节，冷暖关系自然，避免过曝高光和霓虹污染。',
    params: '半身 / 双向布光 / 低饱和',
  },
  {
    id: 'portrait-03',
    category: 'portrait',
    title: '雨夜情绪肖像',
    image: BLACK,
    tags: ['雨夜', '情绪'],
    prompt: '雨夜环境中的 COS 情绪肖像，少量雨珠停留在发丝和脸侧，远景灯光形成自然散景，面部曝光准确，湿润材质与环境光方向一致，画面安静、有张力，真实镜头质感，避免夸张泪痕与过量水滴。',
    params: '长焦 / 浅景深 / 夜景',
  },
  {
    id: 'portrait-04',
    category: 'portrait',
    title: '柔焦逆光人像',
    image: BLACK,
    tags: ['逆光', '柔焦'],
    prompt: '逆光 COS 人像摄影，柔和日光从人物后侧穿过发丝，脸部使用自然反射补光，柔焦只作用于高光与远景，眼睛、睫毛和皮肤纹理清晰，色彩轻盈克制，避免全画面模糊和面部灰暗。',
    params: '逆光 / 局部柔焦 / 暖白色调',
  },
  {
    id: 'portrait-05',
    category: 'portrait',
    title: '暗调侧脸塑形',
    image: WHITE,
    tags: ['侧脸', '明暗塑形'],
    prompt: '暗调 COS 侧脸特写，窄幅侧光勾勒鼻梁、嘴唇与下颌线，阴影保留细节与层次，背景简洁，肤色稳定，发丝自然分离，整体像电影静帧，避免死黑阴影、过度液化和坚硬锐化。',
    params: '特写 / 窄光 / 深阴影',
  },
  {
    id: 'portrait-06',
    category: 'portrait',
    title: '清透日系面光',
    image: BLACK,
    tags: ['清透', '面光'],
    prompt: '清透自然的 COS 人像，柔和大面积面光，肤色干净但保留纹理，眼神明亮，阴影轻薄且有方向，背景色彩低对比，衣服和头发细节完整，真实相机成像，避免纯白肤色、过曝和糖果色滤镜。',
    params: '正面柔光 / 低反差 / 自然肤色',
  },
  {
    id: 'scene-01',
    category: 'scene',
    title: '潮湿旧城天台',
    image: BLACK,
    tags: ['旧城', '夜景'],
    prompt: '电影感 COS 场景合成，人物站在潮湿的旧城天台，远处低饱和霓虹被薄雾削弱，地面有克制的反射，主体与背景光线方向、透视和颗粒一致，真实镜头质感，避免赛博朋克堆砌与夸张发光。',
    params: '宽画幅 / 夜景 / 空气透视',
  },
  {
    id: 'scene-02',
    category: 'scene',
    title: '月面废墟剧场',
    image: WHITE,
    tags: ['废墟', '月光'],
    prompt: '荒废的巨大剧场坐落在月面般的灰白地貌上，COS 人物位于前景三分线，破损拱门形成框景，冷月光穿过尘埃，人物脚下有真实接触阴影，比例宏大但可信，避免悬浮人物与塑料材质。',
    params: '超广角 / 冷月光 / 宏大尺度',
  },
  {
    id: 'scene-03',
    category: 'scene',
    title: '雾中森林神殿',
    image: BLACK,
    tags: ['森林', '薄雾'],
    prompt: '古老森林深处的石质神殿，COS 人物站在长满苔藓的台阶上，清晨薄雾形成明确远近层次，树冠漏下柔和体积光，服装边缘受环境绿色反射，真实潮湿材质，避免浓雾遮挡主体。',
    params: '纵深构图 / 体积光 / 青绿色调',
  },
  {
    id: 'scene-04',
    category: 'scene',
    title: '雪原列车终点',
    image: BLACK,
    tags: ['雪原', '黄昏'],
    prompt: '无尽雪原上的废弃列车站，COS 人物在黄昏冷风中等待，天空为灰蓝到微暖橙色的自然过渡，积雪反射环境光，远景低对比，衣摆方向与风一致，电影剧照质感，避免纯白雪地与过饱和天空。',
    params: '横向构图 / 冷暖交界 / 低对比',
  },
  {
    id: 'scene-05',
    category: 'scene',
    title: '深海玻璃走廊',
    image: WHITE,
    tags: ['深海', '玻璃'],
    prompt: '深海观测站的玻璃走廊，COS 人物靠近巨大观察窗，水下微光在地面和服装上形成真实焦散，窗外生物只保留模糊轮廓，空间潮湿安静，结构透视准确，避免卡通鱼群和高亮蓝色污染。',
    params: '广角 / 水下焦散 / 深青色调',
  },
  {
    id: 'scene-06',
    category: 'scene',
    title: '云端空港候场',
    image: BLACK,
    tags: ['云海', '空港'],
    prompt: '建在云海上方的未来空港，COS 人物在开阔候场平台，建筑线条简洁可信，晨光从侧后方照亮人物，云层具有清晰体积与远近变化，金属表面反射克制，避免密集机械细节和虚假透视。',
    params: '大远景 / 晨光 / 简洁未来感',
  },
  {
    id: 'effect-01',
    category: 'effect',
    title: '克制粒子环绕',
    image: BLACK,
    tags: ['粒子', '纵深'],
    prompt: '为 COS 人物添加少量具有前后景层次的发光粒子，粒子大小、虚实和亮度随距离变化，运动方向呼应人物动作，光线轻微影响附近衣料与皮肤，主体脸部保持干净，避免满屏光点和均匀分布。',
    params: '前中后景 / 局部发光 / 动势引导',
  },
  {
    id: 'effect-02',
    category: 'effect',
    title: '魔法能量弧光',
    image: WHITE,
    tags: ['能量', '弧光'],
    prompt: '人物手部释放弧形魔法能量，核心高亮但保留颜色层次，能量轨迹具有速度变化与细碎尾迹，光线真实照亮手指、袖口和面部下缘，画面保持摄影质感，避免纯色光带与过曝中心。',
    params: '局部特效 / 交互光 / 冷色能量',
  },
  {
    id: 'effect-03',
    category: 'effect',
    title: '破碎空间裂隙',
    image: BLACK,
    tags: ['裂隙', '空间'],
    prompt: '人物身后出现不规则空间裂隙，裂隙边缘像玻璃与空气同时破碎，内部露出另一处低对比场景，碎片遵循透视并产生环境反射，边缘光影响人物轮廓，避免规则圆形传送门和密集碎片。',
    params: '空间置换 / 碎片透视 / 边缘交互',
  },
  {
    id: 'effect-04',
    category: 'effect',
    title: '真实火焰照明',
    image: BLACK,
    tags: ['火焰', '交互光'],
    prompt: '在人物附近加入受风影响的真实火焰，火焰根部明亮、边缘半透明，暖色光照亮最近的皮肤和衣料，远离火焰后迅速衰减，烟雾方向一致，保留暗部，避免贴图边缘和全身橙色覆盖。',
    params: '暖色光源 / 烟火联动 / 明暗衰减',
  },
  {
    id: 'effect-05',
    category: 'effect',
    title: '冰霜蔓延质感',
    image: WHITE,
    tags: ['冰霜', '材质'],
    prompt: '冰霜从人物脚下向周围地面自然蔓延，结晶密度由近到远递减，冰面反射环境并带细小裂纹，冷色光只影响邻近区域，人物鞋底有接触关系，避免规则雪花图案和大面积纯蓝覆盖。',
    params: '表面蔓延 / 冷色反射 / 局部结晶',
  },
  {
    id: 'effect-06',
    category: 'effect',
    title: '风与落叶动势',
    image: BLACK,
    tags: ['落叶', '速度'],
    prompt: '用被风卷起的落叶强化 COS 人物动作方向，近景叶片带运动模糊，中景形状清晰，远景只保留细小色点，衣摆和发丝方向与气流统一，主体面部无遮挡，避免复制粘贴般重复叶片。',
    params: '三层纵深 / 运动模糊 / 动作引导',
  },
  {
    id: 'outfit-01',
    category: 'outfit',
    title: '黑色皮革修复',
    image: BLACK,
    tags: ['皮革', '质感'],
    prompt: '修复 COS 黑色皮革服装的褶皱与表面质感，保留真实缝线、磨损和细微反光，统一明暗但不压死黑色层次，边缘轮廓清晰自然，避免镜面塑料感、涂抹纹理和无理由高光。',
    params: '黑位分层 / 材质恢复 / 缝线保留',
  },
  {
    id: 'outfit-02',
    category: 'outfit',
    title: '轻纱透明层次',
    image: WHITE,
    tags: ['轻纱', '透明'],
    prompt: '优化 COS 轻纱与半透明面料，保留叠层后的明暗变化、织物细节和自然褶皱，透明度随厚度变化，环境光穿过薄纱并轻微染色，避免统一透明度、硬边抠图和发光白纱。',
    params: '半透明 / 叠层 / 柔光',
  },
  {
    id: 'outfit-03',
    category: 'outfit',
    title: '金属盔甲统一',
    image: BLACK,
    tags: ['金属', '盔甲'],
    prompt: '统一 COS 金属盔甲各部件的材质与光线，保留使用痕迹、细小划痕和边缘磨损，反射颜色来自真实环境，亮部有层次不过曝，暗部可见结构，避免镀铬镜面和随机高光。',
    params: '金属反射 / 旧化 / 环境匹配',
  },
  {
    id: 'outfit-04',
    category: 'outfit',
    title: '刺绣纹样强化',
    image: BLACK,
    tags: ['刺绣', '纹样'],
    prompt: '增强 COS 服装刺绣纹样的清晰度与立体感，纹样严格贴合衣料褶皱、透视和光照，线材有细微光泽但不抢主体，保留手工不规则感，避免平面贴图、重复图案和过度锐化。',
    params: '纹样跟随 / 局部锐化 / 织物质感',
  },
  {
    id: 'outfit-05',
    category: 'outfit',
    title: '白色布料找回层次',
    image: WHITE,
    tags: ['白衣', '褶皱'],
    prompt: '恢复过曝 COS 白色服装的布料层次，保留高光细节，以中性灰和环境色刻画褶皱，面料质地柔软真实，人物肤色不受污染，整体仍然明亮通透，避免灰脏白色与硬质阴影。',
    params: '高光恢复 / 环境色 / 柔软材质',
  },
  {
    id: 'outfit-06',
    category: 'outfit',
    title: '披风动态修整',
    image: BLACK,
    tags: ['披风', '动态'],
    prompt: '修整 COS 披风的动态轮廓，让布料受力点、重力和风向合理，褶皱从固定位置自然展开，边缘保留轻微运动模糊，光影与人物一致，避免无支撑悬浮、尖锐折角和重复褶皱。',
    params: '布料动力 / 轮廓整理 / 风向一致',
  },
  {
    id: 'universal-01',
    category: 'universal',
    title: '统一主体与背景',
    image: BLACK,
    tags: ['合成', '统一'],
    prompt: '将 COS 人物自然合成进目标背景，优先统一透视、镜头高度、主光方向、色温和颗粒，再补充接触阴影、环境反射与空气透视，保留人物真实细节，避免边缘光圈、悬浮感和一键滤镜效果。',
    params: '透视 / 光线 / 颗粒统一',
  },
  {
    id: 'universal-02',
    category: 'universal',
    title: '电影感基础调色',
    image: WHITE,
    tags: ['调色', '电影感'],
    prompt: '对 COS 摄影进行克制的电影感调色，稳定肤色与中性色，压低干扰色饱和度，建立清晰但不生硬的明暗层次，高光柔和、阴影有细节，加入细腻统一颗粒，避免青橙套色和黑位堵塞。',
    params: '低饱和 / 柔和高光 / 细颗粒',
  },
  {
    id: 'universal-03',
    category: 'universal',
    title: '边缘与接触检查',
    image: BLACK,
    tags: ['边缘', '检查'],
    prompt: '检查并修正合成图中的人物边缘、发丝、透明材质和脚底接触关系，移除残留底色与过硬蒙版，依据环境补充自然溢色和接触阴影，保持真实镜头柔度，避免白边、黑边和均匀羽化。',
    params: '蒙版清理 / 环境溢色 / 接触阴影',
  },
  {
    id: 'universal-04',
    category: 'universal',
    title: '空气透视增强',
    image: BLACK,
    tags: ['纵深', '空气'],
    prompt: '增强画面的空气透视与空间纵深，近景对比和细节清晰，中景适度收敛，远景降低对比、饱和度与锐度，雾气浓度遵循距离变化，主体仍是视觉焦点，避免整张图覆盖同一层白雾。',
    params: '远近分层 / 对比递减 / 雾气控制',
  },
  {
    id: 'universal-05',
    category: 'universal',
    title: '自然镜头颗粒',
    image: WHITE,
    tags: ['颗粒', '质感'],
    prompt: '为最终合成画面加入统一自然的镜头颗粒，颗粒大小符合输出尺寸，在高光、肤色和深色区域保持一致的摄影逻辑，只用于连接不同素材质感，不掩盖细节，避免彩色噪点、过强锐化和复古滤镜感。',
    params: '统一质感 / 细颗粒 / 输出检查',
  },
  {
    id: 'universal-06',
    category: 'universal',
    title: '最终出片检查',
    image: BLACK,
    tags: ['复盘', '出片'],
    prompt: '以最终交付标准检查 COS 合成作品：缩小确认构图和明暗，正常尺寸检查人物边缘、光线与色彩，放大检查皮肤、服装和材质，修复色带、噪点与锐化问题，确保不同屏幕下主体清晰且层次稳定。',
    params: '构图 / 合成 / 细节三级检查',
  },
]

export const getPromptCategory = (id: PromptLibraryCategoryId) =>
  promptLibraryCategories.find((category) => category.id === id) ?? promptLibraryCategories[0]

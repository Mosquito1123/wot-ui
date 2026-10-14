# RichText 富文本

用于展示文章、活动介绍等 HTML 内容，支持图文排版、图片预览、链接事件、表格和音视频。

适用于 H5、uni-app App-Vue 和小程序，不支持 App-nvue、uni-app x。文字选择、懒加载、合并表格和媒体播放的表现依平台而定；小程序和 App 尚待真机验收。

::: details 内容支持与使用边界

- 支持标题、段落、强调、引用、代码、列表、图片、链接、表格及音视频；支持常用 HTML 实体和数字实体。
- 保留颜色、字体、间距、尺寸、边框等基础排版样式。不支持外部样式表、定位、Flex 或 Grid 内容布局。
- 脚本、事件属性、iframe、SVG 等不支持的嵌入内容会被过滤。建议使用结构完整的 HTML。
- 资源允许 HTTP(S)、协议相对地址和相对路径；链接还允许锚点、`mailto:` 和 `tel:`。资源须符合目标平台的域名与访问规则。
- 单次内容限制为 200000 个 UTF-16 代码单元、10000 个解析节点、128 层嵌套；还有输出数据预算。超限触发 `error` 并显示默认插槽，建议将超长文章拆分加载。
  :::

## 组件类型

### 基础图文

将 HTML 字符串传给 `content` 即可。标题、段落、引用和列表可组合成完整文章；`selectable` 允许在支持的平台选择文字。

```vue
<template>
  <wd-rich-text :content="content" selectable />
</template>

<script setup lang="ts">
const content = `
  <h1>周末出走 · 山野手记</h1>
  <p>沿着林间小路慢慢走，<strong>给生活留一点空白。</strong></p>
  <blockquote>把周末留给山野，把时间还给自己。</blockquote>
  <h2>出发前，装好这三样</h2>
  <ul><li>舒适的鞋</li><li>饮水与轻食</li><li>随身垃圾袋</li></ul>
`
</script>
```

## 组件状态

### 内容更新与空状态

更新 `content` 即可替换内容。空字符串、过滤后无可展示内容或解析失败时，显示默认插槽。

```vue
<template>
  <wd-button @click="content = ''">清空内容</wd-button>
  <wd-rich-text :content="content"><text>还没有新的来信</text></wd-rich-text>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const content = ref('<p><strong>周末来信</strong></p><p>去户外走走，让眼睛看看远处。</p>')
</script>
```

### 图片加载失败

图片失败时显示 `alt` 替代文字，未设置时显示 `×`，同时触发 `error`。

```vue
<wd-rich-text content='<img src="" alt="这张照片暂时无法加载">' />
```

`loading-image` 和 `error-image` 分别设置加载中、失败时的占位图；占位图本身失败会退回文字，不会重复触发图片错误。

```vue
<wd-rich-text :content="content" loading-image="/static/loading.png" error-image="/static/error.png" @image-load="handleImageLoad" />
```

## 组件变体

### 图片预览

普通图片默认支持点击预览。设置 `lazy-load` 开启平台支持的懒加载，设置 `:preview-image="false"` 并监听 `image-click` 可自行处理图片点击。

```vue
<wd-rich-text content='<img src="https://example.com/lake.jpg" alt="山湖风景" width="100%">' lazy-load />
```

未设置尺寸时，图片按容器宽度等比显示。原生预览建议使用 HTTPS 图片；包内路径和 Data 图片的预览需按平台自行处理。

通过图片的 `original-src` 指定高清预览地址，`src` 仍用于显示缩略图。`data-preview="false"` 可让单张图片退出自动预览列表，但仍触发 `image-click`。这些图片属性也经过资源地址校验；无效原图地址退回展示地址。

```html
<img src="https://example.com/thumb.jpg" original-src="https://example.com/full.jpg" alt="山湖风景" />
<img src="https://example.com/logo.png" data-preview="false" alt="装饰图片" />
```

### 链接与图片链接

点击链接只触发 `link-click`，由业务决定导航或其他操作。有效链接包裹的图片也触发该事件；链接地址缺失或被过滤时，图片按普通图片处理。

```vue
<template>
  <wd-rich-text :content="content" @link-click="handleLink" />
</template>

<script setup lang="ts">
const content = '<p>出发前，读一读<a href="/pages/guide/index">行前准备清单</a>。</p>'
function handleLink({ href }: { href: string }) {
  if (href === '/pages/guide/index') uni.navigateTo({ url: href })
}
</script>
```

示例页面的链接会在旁边显示反馈；实际接入时请替换为自己的页面地址。

## 组件样式

### 标签与 class 样式

`tag-style` 设置标签默认样式，`class-styles` 为 HTML 中指定的 class 提供样式。下例将普通图文排成一封邀请函。

```vue
<template>
  <wd-rich-text :content="content" :tag-style="tagStyle" :class-styles="classStyles" />
</template>

<script setup lang="ts">
const content = '<p class="eyebrow">YOU ARE INVITED</p><h2>一起，去见山</h2><p>把一整个下午<br>交给阳光、草地和好朋友。</p>'
const tagStyle = { p: 'text-align:center;line-height:1.9;', h2: 'text-align:center;' }
const classStyles = { eyebrow: 'font-size:12px;letter-spacing:3px;color:var(--wot-success-main);' }
</script>
```

样式优先级为：默认样式 → `tag-style` → `class-styles` → HTML 内联样式。class 通过映射生效，不会直接使用页面同名 CSS。支持常见的 `ql-align-*` 和 `ql-indent-1`–`8` 排版类。

### 主题与文字样式

默认文字随 Wot UI 主题变化。HTML 中的固定颜色会覆盖主题色，建议使用语义 CSS 变量。

```vue
<wd-rich-text
  content="<h3>山野里的晚安</h3><p>愿你今晚，也有一个好梦。</p>"
  custom-style="--wot-rich-text-font-size:16px;--wot-rich-text-line-height:1.9;"
/>
```

## 布局能力

### 列表与表格

支持有序、无序和嵌套列表。宽表格在组件内横向滚动，不会撑宽页面；表格可使用 `rowspan`、`colspan` 合并单元格。

```vue
<wd-rich-text
  content='<table style="width:560px"><tr><th>时间</th><th colspan="2">周末安排</th></tr><tr><td>09:00</td><td>湖畔集合</td><td>沿湖慢走</td></tr></table>'
/>
```

含链接或图片的合并表格使用等宽列，不支持 `col` / `colgroup` 列宽设置；请在目标平台确认合并和滚动效果。

### 目录与锚点

设置 `enable-anchor` 后，可通过 `getHeadings()` 获取标题目录，用 `scrollToAnchor()` 滚动到章节。关闭时保留默认的静态合并渲染，目录为空。

```vue
<template>
  <wd-button v-for="item in headings" :key="item.id" @click="jump(item.id)">{{ item.text }}</wd-button>
  <wd-rich-text ref="article" :content="content" enable-anchor @load="headings = article?.getHeadings() || []" />
</template>
<script setup lang="ts">
import { ref } from 'vue'
import type { RichTextExpose, RichTextHeading } from '@/uni_modules/wot-ui/components/wd-rich-text/types'
const article = ref<RichTextExpose>()
const headings = ref<RichTextHeading[]>([])
const content = '<h2 id="intro">出发之前</h2><p>带上饮水和轻食。</p><h2>沿湖慢走</h2><p>让脚步慢下来。</p>'
async function jump(id: string) {
  try {
    await article.value?.scrollToAnchor(id, { offset: 16, duration: 300 })
  } catch {
    uni.showToast({ title: '章节暂时无法定位', icon: 'none' })
  }
}
</script>
```

标题优先使用 HTML 的 `id`，没有可用 ID 时生成编号；重复 ID 的第一个节点保留原 ID，后续同名标题获得独立编号。内容变化后请重新读取目录。空标题仍保留，业务可按 `text` 过滤。普通元素也可通过 ID 定位；`source`、`thead`、`tbody`、`tfoot`、`tr` 不作为定位目标，可将 ID 放在表格、单元格或内部标题上。

组件不自动执行 `href="#intro"` 的跳转。业务在 `link-click` 中取出锚点 ID，再调用定位方法；带 URL 编码的片段由业务解码。隐藏、未渲染、已删除的目标以及内容更新期间失效的查询会返回 rejected Promise。

::: details 在 scroll-view 中定位
`scrollToAnchor()` 只滚动页面。容器内请用 `getAnchorRect(id)` 获取位置，并用同一套 `uni.createSelectorQuery()` 查询容器的 `top` 与 `scrollTop`，换算后更新容器的 `scroll-top`：

```ts
const nextScrollTop = currentScrollTop + anchor.top - container.top - offset
```

坐标单位为 px，采用 uni-app 内容视口坐标；H5 的顶部导航栏不计入 `top`。图片加载可能改变布局，方法每次重新测量，不缓存位置。`load` 不等待图片完成，需要稳定定位时请预留图片尺寸或在图片加载后操作。
:::

## 内容形态

### 音视频

在 HTML 中使用 `video`、`audio`，也可通过直接子级 `source` 提供多个来源。媒体不会自动播放；视频提供原生控件，音频提供播放与暂停按钮。

```vue
<template>
  <wd-rich-text ref="richText" :content="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import type { RichTextExpose } from '@/uni_modules/wot-ui/components/wd-rich-text/types'

const richText = ref<RichTextExpose>()
const content = '<video src="https://example.com/trip.mp4"></video><audio title="阅读时光" src="https://example.com/music.mp3"></audio>'
onHide(() => richText.value?.pauseMedia())
</script>
```

播放时会暂停同一组件内的其他媒体。页面隐藏时建议调用 `pauseMedia()`。视频封面请使用 HTTP(S) 网络图片地址。请替换示例地址，并确认目标平台支持资源格式及网络访问。

### 长文章

演示页将长文放在最后，点击后才挂载组件。业务中也可通过 `v-if` 按需展示，避免长内容影响其他区域的浏览。

```vue
<template>
  <wd-button @click="expanded = !expanded">{{ expanded ? '收起文章' : '展开文章' }}</wd-button>
  <wd-rich-text v-if="expanded" :content="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ content: string }>()
const expanded = ref(false)
</script>
```

::: details 相对资源与 Base64 图片
`base-url` 仅补全图片、媒体和封面地址，不修改链接 `href`。请使用 HTTP(S) 绝对基址：末尾有 `/` 时按目录解析，否则按文件地址解析。未设置时沿用平台解析规则；基址无效时相对资源被过滤。

`allow-data-image` 默认关闭。开启后接受不超过 64 KiB 的 PNG/JPEG/GIF/WebP Base64 图片，不接受 SVG。Data 图片触发 `image-click`，但不自动调用原生预览。
:::

## Attributes

| 参数             | 说明                                 | 类型                     | 默认值  |
| ---------------- | ------------------------------------ | ------------------------ | ------- |
| loading-image    | 图片加载中占位图，失败后退回文字     | `string`                 | `''`    |
| error-image      | 图片失败占位图，失败后退回 alt       | `string`                 | `''`    |
| enable-anchor    | 开启标题目录与锚点定位               | `boolean`                | `false` |
| content          | HTML 字符串                          | `string`                 | `''`    |
| selectable       | 允许选择文字，实际行为依平台而定     | `boolean`                | `false` |
| preview-image    | 点击普通图片时自动预览               | `boolean`                | `true`  |
| lazy-load        | 开启平台支持的图片懒加载             | `boolean`                | `false` |
| base-url         | 资源基址；不转换链接 href            | `string`                 | `''`    |
| allow-data-image | 允许受限栅格 Base64 图片；不自动预览 | `boolean`                | `false` |
| tag-style        | 标签默认样式映射                     | `Record<string, string>` | `{}`    |
| class-styles     | class 到内联样式的显式映射           | `Record<string, string>` | `{}`    |
| custom-class     | 根节点自定义类名                     | `string`                 | `''`    |
| custom-style     | 根节点内联样式                       | `string`                 | `''`    |

## Events

| 事件名称    | 说明                                                         | 参数                                                                                                          |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| image-load  | 原内容中的图片成功加载，每个图片节点一次；不包含占位图       | `{ src: string, index: number, width: number, height: number }`，宽高为实际像素尺寸                           |
| load        | 成功解析及节点更新完成，包含过滤后为空的情况；不等待图片加载 | `{ imageCount: number }`                                                                                      |
| error       | 解析或资源错误                                               | parse：`{ source, message, code? }`；image：`{ source, src, index }`；audio/video：`{ source, src, message }` |
| link-click  | 点击有有效地址的链接，包括图片链接                           | `{ href: string }`                                                                                            |
| image-click | 点击普通图片，无论是否开启自动预览；加载失败的图片不触发     | `{ src: string, index: number }`                                                                              |
| media-play  | 音视频开始播放                                               | `{ type: 'video' \| 'audio', src: string }`                                                                   |
| media-pause | 音视频暂停                                                   | 同上                                                                                                          |
| media-ended | 音视频播放结束                                               | 同上                                                                                                          |

图片 `index` 为内容中的出现顺序，从 0 开始，包含图片链接及没有有效地址的图片。

## Methods

| 方法名称       | 说明                                                       | 参数                                                                             | 返回值                                     |
| -------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| getHeadings    | 获取当前标题目录的副本，未开启时为空                       | -                                                                                | `RichTextHeading[]`：`{ id, level, text }` |
| getAnchorRect  | 查询目标在内容视口中的位置                                 | `id: string`                                                                     | `Promise<{ top, left, width, height }>`    |
| scrollToAnchor | 页面滚动至目标；offset 为顶部预留距离，duration 为动画时长 | `id: string, options?: { offset?: number, duration?: number }`，默认 0px / 300ms | `Promise<void>`                            |
| getText        | 获取过滤后的纯文本，保留段落、换行和图片替代文字           | -                                                                                | `string`                                   |
| pauseMedia     | 暂停当前实例的全部媒体                                     | -                                                                                | `void`                                     |

## Slots

| 名称    | 说明                                       |
| ------- | ------------------------------------------ |
| default | 内容为空、过滤后无渲染节点或解析失败时显示 |

## CSS Variables

| 名称                              | 说明                 |
| --------------------------------- | -------------------- |
| --wot-rich-text-color             | 正文颜色             |
| --wot-rich-text-font-size         | 正文字号             |
| --wot-rich-text-line-height       | 正文行高，默认 `1.7` |
| --wot-rich-text-link-color        | 链接颜色             |
| --wot-rich-text-image-state-color | 图片状态文字颜色     |
| --wot-rich-text-image-state-bg    | 图片状态背景色       |

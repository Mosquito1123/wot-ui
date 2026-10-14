# RichText

Display HTML articles and activity descriptions with formatted text, image previews, link events, tables, audio, and video.

Targets H5, uni-app App-Vue, and mini programs. App-nvue and uni-app x are not supported. Text selection, lazy loading, merged tables, and media playback vary by platform; mini program and App behavior still requires device validation.

::: details Supported content and boundaries

- Supports headings, paragraphs, emphasis, quotes, code, lists, images, links, tables, and media, plus common named and numeric HTML entities.
- Preserves basic typography, colors, spacing, dimensions, and borders. External stylesheets, positioning, Flex, and Grid content layouts are not supported.
- Scripts, event attributes, iframe, SVG, and other unsupported embedded content are filtered. Use well-formed HTML where possible.
- Resources accept HTTP(S), protocol-relative URLs, and relative paths. Links also accept anchors, `mailto:`, and `tel:`. Platform domain and access requirements still apply.
- Each input is limited to 200000 UTF-16 code units, 10000 parsed nodes, and 128 nesting levels, with additional output budgets. Exceeding a limit emits `error` and displays the default slot. Split very long articles into sections.
  :::

## Component Type

### Article

Pass an HTML string to `content`. Combine headings, paragraphs, quotes, and lists into an article. Enable `selectable` to allow text selection on supported platforms.

```vue
<template>
  <wd-rich-text :content="content" selectable />
</template>

<script setup lang="ts">
const content = `
  <h1>A weekend in the wild</h1>
  <p>Walk slowly along a forest path. <strong>Leave a little room for life.</strong></p>
  <blockquote>Give your weekend to the mountains, and your time to yourself.</blockquote>
  <h2>Three things to bring</h2>
  <ul><li>Comfortable shoes</li><li>Water and snacks</li><li>A bag for your litter</li></ul>
`
</script>
```

## Component State

### Updating and empty content

Change `content` to replace the article. The default slot appears for an empty string, content with no visible nodes after filtering, or a parsing failure.

```vue
<template>
  <wd-button @click="content = ''">Clear content</wd-button>
  <wd-rich-text :content="content"><text>No new letters yet</text></wd-rich-text>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const content = ref('<p><strong>A weekend letter</strong></p><p>Step outside and let your eyes wander.</p>')
</script>
```

### Failed images

Failed images display their `alt` text, or `×` when absent, and emit `error`.

```vue
<wd-rich-text content='<img src="" alt="This photo is temporarily unavailable">' />
```

Use `loading-image` and `error-image` for loading and error placeholders. If a placeholder fails, text is shown instead without emitting another image error.

```vue
<wd-rich-text :content="content" loading-image="/static/loading.png" error-image="/static/error.png" @image-load="handleImageLoad" />
```

## Component Variant

### Image preview

Ordinary images open a preview on click by default. Enable `lazy-load` for platform-supported lazy loading. Set `:preview-image="false"` and handle `image-click` to provide your own interaction.

```vue
<wd-rich-text content='<img src="https://example.com/lake.jpg" alt="A mountain lake" width="100%">' lazy-load />
```

Images without explicit dimensions scale proportionally to the container width. HTTPS images are recommended for native preview; handle package paths and Data images according to platform requirements.

Set an image's `original-src` to a high-resolution preview URL while retaining `src` for its thumbnail. `data-preview="false"` excludes an image from automatic preview while still emitting `image-click`. These attributes undergo resource URL validation; an invalid original URL falls back to the display URL.

```html
<img src="https://example.com/thumb.jpg" original-src="https://example.com/full.jpg" alt="A mountain lake" />
<img src="https://example.com/logo.png" data-preview="false" alt="A decorative image" />
```

### Links and linked images

Links emit `link-click`; your application decides how to navigate or respond. Images inside valid links also emit this event. If the link URL is absent or filtered, the image behaves like an ordinary image.

```vue
<template>
  <wd-rich-text :content="content" @link-click="handleLink" />
</template>

<script setup lang="ts">
const content = '<p>Before leaving, read the <a href="/pages/guide/index">packing checklist</a>.</p>'
function handleLink({ href }: { href: string }) {
  if (href === '/pages/guide/index') uni.navigateTo({ url: href })
}
</script>
```

Demo links display nearby feedback. Replace them with your own page URLs when integrating the component.

## Component Style

### Tag and class styles

Use `tag-style` for tag defaults and `class-styles` for named HTML classes. This example turns ordinary text into an invitation.

```vue
<template>
  <wd-rich-text :content="content" :tag-style="tagStyle" :class-styles="classStyles" />
</template>

<script setup lang="ts">
const content =
  '<p class="eyebrow">YOU ARE INVITED</p><h2>Meet us in the mountains</h2><p>Spend an afternoon<br>with sunshine, grass, and good friends.</p>'
const tagStyle = { p: 'text-align:center;line-height:1.9;', h2: 'text-align:center;' }
const classStyles = { eyebrow: 'font-size:12px;letter-spacing:3px;color:var(--wot-success-main);' }
</script>
```

Precedence: defaults → `tag-style` → `class-styles` → inline HTML styles. Classes use these mappings rather than matching page CSS. Common `ql-align-*` and `ql-indent-1`–`8` formatting classes are supported.

### Theme and typography

Default text follows the Wot UI theme. Fixed colors in HTML override theme colors; prefer semantic CSS variables.

```vue
<wd-rich-text
  content="<h3>Good night from the mountains</h3><p>May your dreams be peaceful tonight.</p>"
  custom-style="--wot-rich-text-font-size:16px;--wot-rich-text-line-height:1.9;"
/>
```

## Layout

### Lists and tables

Ordered, unordered, and nested lists are supported. Wide tables scroll horizontally inside the component without widening the page. Use `rowspan` and `colspan` to merge cells.

```vue
<wd-rich-text
  content='<table style="width:560px"><tr><th>Time</th><th colspan="2">Weekend plan</th></tr><tr><td>09:00</td><td>Meet by the lake</td><td>A gentle walk</td></tr></table>'
/>
```

Merged tables containing links or images use equal-width columns. `col` / `colgroup` width definitions are not supported. Verify merging and scrolling on your target platforms.

### Contents and anchors

Enable `enable-anchor`, read the heading list with `getHeadings()`, and navigate with `scrollToAnchor()`. When disabled, default static batching remains active and the heading list is empty.

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
const content = '<h2 id="intro">Before leaving</h2><p>Bring water and snacks.</p><h2>Along the lake</h2><p>Take your time.</p>'
async function jump(id: string) {
  try {
    await article.value?.scrollToAnchor(id, { offset: 16, duration: 300 })
  } catch {
    uni.showToast({ title: 'Section unavailable', icon: 'none' })
  }
}
</script>
```

Headings use their HTML `id` when available, otherwise a generated identifier. The first occurrence retains a duplicate ID; later headings receive separate identifiers. Refresh the directory after content changes. Empty headings remain in the result and can be filtered by `text`. Ordinary elements can also be targets; `source`, `thead`, `tbody`, `tfoot`, and `tr` are excluded. Put IDs on the table, cells, or inner headings instead.

The component does not automatically follow `href="#intro"`. Extract the ID in `link-click` and call the navigation method; decode URL-encoded fragments in application code. Hidden, unrendered, removed targets and queries invalidated by content updates reject their Promise.

::: details Navigation inside a scroll-view
`scrollToAnchor()` scrolls the page only. For a container, use `getAnchorRect(id)` and query the container's `top` and `scrollTop` with `uni.createSelectorQuery()`. Update its `scroll-top` using:

```ts
const nextScrollTop = currentScrollTop + anchor.top - container.top - offset
```

Coordinates use pixels in the uni-app content viewport, excluding the H5 navigation bar. Image loading can change layout; every call measures again rather than caching positions. `load` does not wait for images. Reserve image dimensions or navigate after image loading when a stable position is required.
:::

## Content Formats

### Audio and video

Use `video` and `audio` in HTML. Direct `source` children can provide multiple sources. Media does not autoplay. Video uses native controls; audio provides play and pause buttons.

```vue
<template>
  <wd-rich-text ref="richText" :content="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import type { RichTextExpose } from '@/uni_modules/wot-ui/components/wd-rich-text/types'

const richText = ref<RichTextExpose>()
const content = '<video src="https://example.com/trip.mp4"></video><audio title="Reading time" src="https://example.com/music.mp3"></audio>'
onHide(() => richText.value?.pauseMedia())
</script>
```

Playing media pauses other media in the same component. Call `pauseMedia()` when the page hides. Use an HTTP(S) image URL for the video poster. Replace the example URLs and verify format support and network access on your target platforms.

### Long articles

The demo places the long article last and mounts it only when expanded. Use `v-if` to display long content on demand so it does not obstruct other examples.

```vue
<template>
  <wd-button @click="expanded = !expanded">{{ expanded ? 'Collapse article' : 'Expand article' }}</wd-button>
  <wd-rich-text v-if="expanded" :content="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ content: string }>()
const expanded = ref(false)
</script>
```

::: details Relative resources and Base64 images
`base-url` resolves images, media, and posters without changing link `href` values. Use an absolute HTTP(S) base: a trailing `/` is treated as a directory, otherwise as a file URL. Without a base, platform resolution applies; an invalid base filters relative resources.

`allow-data-image` is disabled by default. When enabled, it accepts PNG/JPEG/GIF/WebP Base64 images up to 64 KiB, excluding SVG. Data images emit `image-click` but do not open native preview automatically.
:::

## Attributes

| Parameter        | Description                                                  | Type                     | Default |
| ---------------- | ------------------------------------------------------------ | ------------------------ | ------- |
| loading-image    | Loading placeholder URL; falls back to text on failure       | `string`                 | `''`    |
| error-image      | Error placeholder URL; falls back to alt text on failure     | `string`                 | `''`    |
| enable-anchor    | Enable the heading directory and anchor navigation           | `boolean`                | `false` |
| content          | HTML content                                                 | `string`                 | `''`    |
| selectable       | Allow text selection, subject to platform behavior           | `boolean`                | `false` |
| preview-image    | Automatically preview ordinary images                        | `boolean`                | `true`  |
| lazy-load        | Enable platform image lazy loading                           | `boolean`                | `false` |
| base-url         | Resource base URL; href is unchanged                         | `string`                 | `''`    |
| allow-data-image | Allow bounded raster Base64 images, excluding native preview | `boolean`                | `false` |
| tag-style        | Default inline styles by tag                                 | `Record<string, string>` | `{}`    |
| class-styles     | HTML class token to inline style mapping                     | `Record<string, string>` | `{}`    |
| custom-class     | Root class                                                   | `string`                 | `''`    |
| custom-style     | Root inline style                                            | `string`                 | `''`    |

## Events

| Event       | Description                                                                                       | Parameters                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| image-load  | An original content image loaded, once per node; excludes placeholders                            | `{ src: string, index: number, width: number, height: number }`; intrinsic pixel dimensions                   |
| load        | Successful parsing and node updates, including an empty filtered result; does not wait for images | `{ imageCount: number }`                                                                                      |
| error       | Parse or resource failure                                                                         | parse: `{ source, message, code? }`; image: `{ source, src, index }`; audio/video: `{ source, src, message }` |
| link-click  | Valid text or image link clicked                                                                  | `{ href: string }`                                                                                            |
| image-click | Ordinary image clicked; failed images do not emit this event                                      | `{ src: string, index: number }`                                                                              |
| media-play  | Playback starts                                                                                   | `{ type: 'video' \| 'audio', src: string }`                                                                   |
| media-pause | Playback pauses                                                                                   | Same as media-play                                                                                            |
| media-ended | Playback ends                                                                                     | Same as media-play                                                                                            |

Image indices are zero-based occurrence indices, including linked images and images without valid URLs.

## Methods

| Method         | Description                                                                                     | Parameters                                                                              | Return value                               |
| -------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| getHeadings    | Copy the current heading list; empty when anchors are disabled                                  | -                                                                                       | `RichTextHeading[]`: `{ id, level, text }` |
| getAnchorRect  | Query the target's position in the content viewport                                             | `id: string`                                                                            | `Promise<{ top, left, width, height }>`    |
| scrollToAnchor | Scroll the page to a target; offset reserves space above it and duration controls the animation | `id: string, options?: { offset?: number, duration?: number }`; defaults to 0px / 300ms | `Promise<void>`                            |
| getText        | Filtered plain text with block breaks, line breaks and image alt text                           | -                                                                                       | `string`                                   |
| pauseMedia     | Pause all media in this instance                                                                | -                                                                                       | `void`                                     |

## Slots

| Name    | Description                                                        |
| ------- | ------------------------------------------------------------------ |
| default | Empty input, zero rendered nodes after filtering, or parse failure |

## CSS Variables

| Name                              | Description                    |
| --------------------------------- | ------------------------------ |
| --wot-rich-text-color             | Text color                     |
| --wot-rich-text-font-size         | Text size                      |
| --wot-rich-text-line-height       | Line height, defaults to `1.7` |
| --wot-rich-text-link-color        | Link color                     |
| --wot-rich-text-image-state-color | Image status text color        |
| --wot-rich-text-image-state-bg    | Image status background        |

<template>
  <view :id="anchorId" class="wd-rich-text__media" :style="node.style" @tap.stop>
    <text v-if="failed" class="wd-rich-text__media-error">{{ node.alt }} ×</text>
    <video
      v-else-if="node.mediaType === 'video'"
      :id="mediaId"
      class="wd-rich-text__video"
      :style="node.fixedHeight ? 'height:100%' : ''"
      :src="source"
      :poster="node.poster"
      :loop="node.loop"
      :muted="node.muted"
      :controls="true"
      :autoplay="false"
      @play="handlePlay"
      @pause="handlePause"
      @ended="handleEnded"
      @error="handleError"
    />
    <button v-else class="wd-rich-text__audio-control" @tap.stop="toggleAudio">{{ playing ? 'Ⅱ' : '▶' }} {{ node.alt }}</button>
  </view>
</template>
<script lang="ts" setup>
import { computed, getCurrentInstance, inject, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
import { measureAnchor } from '../anchor'
import { richTextContextKey, type RichTextRenderNode } from '../types'

defineOptions({
  name: 'wd-rich-text-media',
  options: {
    // #ifndef MP-TOUTIAO
    virtualHost: true,
    // #endif
    addGlobalClass: true,
    styleIsolation: 'shared'
  }
})
const props = defineProps({ node: { type: Object as PropType<RichTextRenderNode>, required: true }, anchorId: String })
const instance = getCurrentInstance()
const mediaId = `wd-rich-text-media-${instance?.uid}`
const context = inject(richTextContextKey)
const sourceIndex = ref(0)
const source = computed(() => props.node.sources?.[sourceIndex.value] || '')
const playing = ref(false)
const failed = ref(false)
let disposed = false
let unregisterAnchor: (() => void) | undefined
let playbackRequested = false
let audio: UniApp.InnerAudioContext | undefined
let video: UniApp.VideoContext | undefined
const unregister = context?.registerMedia(mediaId, pause)

onMounted(() => {
  if (props.node.anchorId && props.anchorId)
    unregisterAnchor = context?.registerAnchor(props.node.anchorId, () => measureAnchor(props.anchorId!, instance!.proxy!))
  if (!source.value) {
    fail('No playable source')
    return
  }
  if (props.node.mediaType === 'audio') {
    if (typeof uni.createInnerAudioContext !== 'function') {
      fail('Audio is unavailable on this platform')
      return
    }
    audio = uni.createInnerAudioContext()
    audio.autoplay = false
    audio.loop = !!props.node.loop
    audio.volume = props.node.muted ? 0 : 1
    audio.onPlay(handlePlay)
    audio.onPause(handlePause)
    audio.onEnded(handleEnded)
    audio.onError((error) => {
      void handleError({ detail: error })
    })
    audio.src = source.value
  } else video = uni.createVideoContext(mediaId, instance?.proxy || undefined)
})
onBeforeUnmount(() => {
  disposed = true
  unregister?.()
  unregisterAnchor?.()
  audio?.stop()
  audio?.destroy()
  video?.pause()
})

function pause() {
  playbackRequested = false
  audio?.pause()
  video?.pause()
}
function toggleAudio() {
  if (playing.value) pause()
  else {
    playbackRequested = true
    audio?.play()
  }
}
function notify(event: 'play' | 'pause' | 'ended') {
  if (!disposed) context?.mediaEvent(mediaId, event, { type: props.node.mediaType || 'video', src: source.value })
}
function handlePlay() {
  if (disposed) return
  playbackRequested = true
  playing.value = true
  notify('play')
}
function handlePause() {
  if (disposed) return
  playbackRequested = false
  playing.value = false
  notify('pause')
}
function handleEnded() {
  if (disposed) return
  playbackRequested = false
  playing.value = false
  notify('ended')
}
function fail(message: string) {
  if (disposed || failed.value) return
  failed.value = true
  playing.value = false
  context?.mediaError({ source: props.node.mediaType || 'video', src: source.value, message })
}
/** 按 source 顺序尝试下一地址；所有来源都失败后才上报一次错误。 */
async function handleError(event?: { detail?: { errMsg?: string } }) {
  if (disposed || failed.value) return
  if (sourceIndex.value + 1 < (props.node.sources?.length || 0)) {
    const resume = playing.value || playbackRequested
    playing.value = false
    sourceIndex.value++
    if (audio) {
      audio.src = source.value
      if (resume) audio.play()
    }
    await nextTick()
    if (!disposed && video && resume) video.play()
  } else fail(event?.detail?.errMsg || 'Media loading failed')
}
</script>
<style lang="scss">
@use '../index.scss';
</style>

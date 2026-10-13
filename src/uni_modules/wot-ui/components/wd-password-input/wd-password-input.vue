<template>
  <view :class="`wd-password-input ${customClass}`" :style="customStyle">
    <view @touchstart="onTouchStart" class="wd-password-input__security">
      <view
        v-for="(_, index) in length"
        :key="index"
        :class="`wd-password-input__item ${gutter ? '' : 'is-border'}`"
        :style="{ marginLeft: index !== 0 && gutter ? addUnit(gutter) : 0 }"
      >
        <view v-if="cursorActive && index === modelValue.length" class="wd-password-input__cursor"></view>
        <view v-else :class="`wd-password-input__value`">
          <view :style="{ visibility: mask && modelValue[index] ? 'visible' : 'hidden' }" class="wd-password-input__mask"></view>
          <text v-if="!mask && modelValue[index]">{{ modelValue[index] }}</text>
        </view>
      </view>
      <input
        v-if="nativeInput"
        class="wd-password-input__native"
        :type="nativeKeyboardType"
        inputmode="numeric"
        :maxlength="nativePasteMaxLength"
        :text-content-type="mask ? 'off' : 'one-time-code'"
        :value="nativeValue"
        @input="handleNativeInput"
        @paste="handleNativePaste"
        @focus="handleNativeFocus"
        @blur="handleNativeBlur"
      />
    </view>
    <view v-if="info || errorInfo" :class="`wd-password-input__info ${errorInfo ? 'is-error' : ''}`">
      {{ errorInfo || info }}
    </view>
  </view>
</template>

<script lang="ts">
export default {
  name: 'wd-password-input',
  options: {
    // #ifndef MP-TOUTIAO
    virtualHost: true,
    // #endif
    addGlobalClass: true,
    styleIsolation: 'shared'
  }
}
</script>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { addUnit } from '../../common/util'
import { passwordInputProps } from './types'

interface NativeInputEvent {
  detail?: {
    value?: string | number
  }
  target?: {
    value?: string | number
  }
  currentTarget?: {
    value?: string | number
  }
}

interface NativePasteEvent {
  clipboardData?: {
    getData?: (type: string) => string
  }
  preventDefault?: () => void
}

const props = defineProps(passwordInputProps)

const emit = defineEmits(['focus', 'update:modelValue'])

const nativeFocused = ref(false)
const nativeValue = ref(props.modelValue)
let ignoreNativeInput = false
let ignoreNativeInputTimer: ReturnType<typeof setTimeout> | undefined
// 小程序用 digit 调出数字键盘；H5 的 digit 会被映射成 number，会丢掉前导 0，因此 H5 用 text + inputmode。
let nativeKeyboardType = 'digit'
// #ifdef H5
nativeKeyboardType = 'text'
// #endif
// 大于格子长度，避免短信原文在过滤数字前被原生 maxlength 截断。
const nativePasteMaxLength = 500

const cursorActive = computed(() => (props.nativeInput ? nativeFocused.value : props.focused))

watch(
  () => props.modelValue,
  (value) => {
    nativeValue.value = value
  }
)

function onTouchStart(event: Event) {
  if (props.nativeInput) return
  emit('focus', event)
}

/**
 * 只保留数字，并截断到密码长度。全角数字会先转成半角。
 */
function sanitizePassword(value: unknown) {
  const normalized = String(value ?? '').replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
  const maxLength = Number(props.length)
  const limit = Number.isFinite(maxLength) && maxLength > 0 ? Math.floor(maxLength) : 0
  return normalized.replace(/\D/g, '').slice(0, limit)
}

function readNativeValue(event: NativeInputEvent) {
  const detailValue = event.detail?.value
  if (detailValue != null) return String(detailValue)
  const targetValue = event.target?.value ?? event.currentTarget?.value
  if (targetValue != null) return String(targetValue)
  return ''
}

function commitNativeValue(raw: string) {
  const next = sanitizePassword(raw)
  nativeValue.value = next
  if (next !== props.modelValue) {
    emit('update:modelValue', next)
  }
}

function handleNativeInput(event: NativeInputEvent) {
  if (ignoreNativeInput) return
  commitNativeValue(readNativeValue(event))
}

function handleNativePaste(event: NativePasteEvent) {
  const text = event.clipboardData?.getData?.('text')
  if (text == null) return
  const next = sanitizePassword(text)
  event.preventDefault?.()
  if (!next) return
  ignoreNativeInput = true
  if (ignoreNativeInputTimer) clearTimeout(ignoreNativeInputTimer)
  // uni-app H5 的 input 事件大约延迟 100ms，这段时间内忽略回写，避免未过滤文本覆盖粘贴结果。
  ignoreNativeInputTimer = setTimeout(() => {
    ignoreNativeInput = false
  }, 200)
  commitNativeValue(next)
}

onBeforeUnmount(() => {
  if (ignoreNativeInputTimer) clearTimeout(ignoreNativeInputTimer)
})

function handleNativeFocus(event: Event) {
  nativeFocused.value = true
  emit('focus', event)
}

function handleNativeBlur() {
  nativeFocused.value = false
}
</script>

<style lang="scss">
@use './index.scss';
</style>

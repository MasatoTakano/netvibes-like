<template>
  <div
    ref="memoNoteRef"
    class="memo-note-content"
    :style="memoStyle"
    @click="startEditingOnClick"
  >
    <div
      v-if="!isEditing"
      ref="displayRef"
      class="content-display"
      v-html="linkedContentHtml"
    ></div>
    <textarea
      v-else
      ref="textareaRef"
      v-model="editingContent"
      class="content-edit"
      :style="memoStyle"
      :placeholder="$t('widget.memoPlaceholder')"
      @blur="handleBlur"
      @keydown.esc.prevent="cancelEditing"
      @input="adjustTextareaHeight"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
  import { ref, nextTick, computed } from 'vue';
  import DOMPurify from 'dompurify';
  import { URL_SHORTEN_CUTOFF_LENGTH } from '~/constants';

  // --- Props ---
  const props = withDefaults(
    defineProps<{
      id: string;
      content: string;
      title?: string;
      fontFamily?: string | null; // null = グローバル設定を使う
      fontSize?: number | null;
    }>(),
    {
      title: '',
      fontFamily: null,
      fontSize: null,
    },
  );

  const urlCutoffLength = URL_SHORTEN_CUTOFF_LENGTH;

  // --- Emits ---
  const emit = defineEmits(['update:content']);

  // --- State ---
  const isEditing = ref(false);
  const editingContent = ref('');
  const memoNoteRef = ref<HTMLDivElement | null>(null);
  const textareaRef = ref<HTMLTextAreaElement | null>(null);
  const displayRef = ref<HTMLDivElement | null>(null);

  // --- Computed ---
  // スタイルバインディング用の computed プロパティ
  const memoStyle = computed(() => {
    const style: Record<string, string> = {};
    if (props.fontFamily) {
      // 値があれば設定
      style.fontFamily = props.fontFamily;
    }
    if (props.fontSize) {
      // 値があれば設定
      style.fontSize = `${props.fontSize}px`;
    }
    return style;
  });

  // ↓↓↓ 通常表示用のリンク化されたコンテンツ (computed) ↓↓↓
  const linkedContentHtml = computed(() => {
    // props.content を linkifyUrls で処理し、改行を <br> に変換
    const linked = linkifyUrls(props.content, true);
    return linked;
  });

  // --- Methods ---
  const shortenUrl = (url: string): string => {
    if (url.length <= urlCutoffLength) return url;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const lastChars = url.slice(-10);
      return `${urlObj.protocol}//${domain}/.../${lastChars}`;
    } catch {
      // フォールバック：単純に60文字で切り捨て
      return url.slice(0, 60) + '...';
    }
  };

  const linkifyUrls = (text: string, shouldShorten: boolean = false): string => {
    if (!text) return '';

    // v-html に渡すため、HTML組み立て後に DOMPurify で最終サニタイズする。
    // リンク化対象は http/https のみに限定し、file: や javascript: 等は生成しない。
    const urlRegex = /(https?:\/\/[^\s<>'"]+)/gi;
    const parts: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0];
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
      const safeUrl = escapeHtmlAttribute(url);
      const displayText = escapeHtml(shouldShorten ? shortenUrl(url) : url);
      parts.push(
        `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${displayText}</a>`,
      );
      lastIndex = match.index + url.length;
    }

    parts.push(escapeHtml(text.slice(lastIndex)));

    return DOMPurify.sanitize(parts.join(''), {
      ALLOWED_TAGS: ['a'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  };

  const escapeHtml = (unsafe: string): string => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const escapeHtmlAttribute = (unsafe: string): string => {
    return escapeHtml(unsafe).replace(/`/g, '&#096;');
  };

  // 編集開始（通常表示エリアクリック時）
  const startEditingOnClick = (event: MouseEvent) => {
    if (isEditing.value || (event.target as HTMLElement).tagName === 'A') {
      return;
    }
    startEditing();
  };

  // startEditing (高さ取得ロジックは維持)
  const startEditing = async () => {
    if (isEditing.value) return;
    let initialHeight = 100;
    if (displayRef.value) {
      const contentHeight = displayRef.value.offsetHeight;
      initialHeight = Math.max(contentHeight, 100);
    }
    // 編集中は renderedHtml をクリアする必要はない (v-if で非表示になるため)
    isEditing.value = true;
    editingContent.value = props.content;
    await nextTick();
    if (textareaRef.value) {
      textareaRef.value.style.height = `${initialHeight}px`;
      adjustTextareaHeight();
      textareaRef.value.focus();
    }
    document.addEventListener('click', handleClickOutside, true);
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.value;
    if (textarea) {
      // 高さを一旦リセットして、内容に必要な高さをscrollHeightから取得
      textarea.style.height = 'auto';
      // scrollHeightに基づいて新しい高さを設定 (padding等も考慮される)
      // 少し余裕を持たせる (任意)
      const newHeight = textarea.scrollHeight;
      textarea.style.height = `${newHeight}px`;
    }
  };

  // 編集終了（保存）
  const finishEditing = () => {
    if (!isEditing.value) return;
    const contentChanged = editingContent.value !== props.content;

    // 先に isEditing を false に戻す。これにより watch が発火し、
    // 変更があれば新しい内容で、なければ元の内容で renderedHtml が更新される。
    isEditing.value = false;
    document.removeEventListener('click', handleClickOutside, true);

    if (contentChanged) {
      emit('update:content', editingContent.value);
    } else {
      // 再レンダリングは watch に任せる
    }
    // Textarea の高さリセット
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
    }
  };

  // 編集キャンセル（Escキー）
  const cancelEditing = () => {
    if (!isEditing.value) return;

    // 先に isEditing を false に戻す。これにより watch が発火し、
    // 元の内容で renderedHtml が更新される。
    isEditing.value = false;
    document.removeEventListener('click', handleClickOutside, true);
    editingContent.value = ''; // 編集内容は破棄

    // Textarea の高さリセット
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
    }
  };

  // textarea からフォーカスが外れた時の処理
  const handleBlur = () => {
    // setTimeout を使って、範囲外クリックハンドラが先に実行されるのを待つ猶予を与える
    // (関連ターゲットがない場合や、関連ターゲットがコンポーネント外部の場合に保存)
    //   -> 複雑になるので、一旦 blur 時に常に保存を試みる simpler approach
    finishEditing();
  };

  // 範囲外クリックのハンドラ
  const handleClickOutside = (event: MouseEvent) => {
    if (!memoNoteRef.value || !isEditing.value) {
      return;
    }
    // クリックされた場所がコンポーネントの内部（textarea含む）でないことを確認
    if (!memoNoteRef.value.contains(event.target as Node)) {
      finishEditing();
    }
  };
</script>

<style scoped>
  .memo-note-widget {
    background-color: var(--input-bg-color);
    color: var(--input-text-color);
    height: 100%;
    overflow-wrap: break-word;
    display: flex;
    flex-direction: column;
  }

  .memo-note-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* 通常表示エリア */
  .content-display {
    width: 100%;
    padding: 4px 4px;
    box-sizing: border-box;
    line-height: 1.3;
    font-family: inherit;
    font-size: inherit;
    word-wrap: break-word;
    overflow-wrap: break-word; /* ここまで共通 */
    background-color: var(--input-bg-color);
    color: var(--input-text-color);
    cursor: pointer;
    min-height: 20px; /* 最低限の高さ */
    white-space: pre-wrap;
    flex-grow: 1;
    overflow-y: auto; /* スクロール */
  }
  .content-display :deep(a) {
    color: #007bff; /* リンク色 */
    text-decoration: underline;
    cursor: pointer;
  }
  .content-display :deep(a:hover) {
    color: #0056b3;
  }

  /* 編集中のテキストエリア */
  .content-edit {
    width: 100%;
    padding: 4px 4px;
    box-sizing: border-box;
    line-height: 1.3;
    font-family: inherit;
    font-size: inherit;
    word-wrap: break-word;

    min-height: 100px; /* 編集エリアの最低限の高さ */
    height: auto;
    border: 1px solid #ccc;
    border-radius: 3px; /* 少し角丸 */
    resize: vertical;
    outline: none;
    overflow-y: hidden; /* 自動高さ調整のため */
    flex-grow: 1;
  }
</style>

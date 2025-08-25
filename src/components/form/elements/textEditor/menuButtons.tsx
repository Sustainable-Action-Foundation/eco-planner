'use client';

// TODO: Pressing enter will activate the menuitem and move focus to the texteditor while pressing space will keep focus in the menu.
// The spec does not tell us to do this, and we should probably check against a screenreader to make sure it seems reasonable.

import { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { IconArrowBackUp, IconArrowForwardUp, IconItalic, IconBold, IconStrikethrough, IconUnderline, IconSuperscript, IconSubscript, IconHighlight, IconLink, IconList, IconListNumbers, IconChevronDown, IconDotsVertical, IconWorld, IconEdit, IconLinkOff, IconPencil, IconCopy } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from './textEditor.module.css' with { type: "css" }
import { allowedProtocols } from './textEditor';
import { TFunction } from "i18next";
import { BubbleMenu } from '@tiptap/react/menus'

export function Undo({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {

  const canUndo = useEditorState({
    editor,
    selector: ctx => {
      return {
        canUndo: ctx.editor.can().undo(),
      };
    },
  });

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().undo().run()}
      onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().undo().run();
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().undo().run();
        }
      }}
      tabIndex={0}
      aria-label={t("forms:text_editor_menu.undo")}
      aria-keyshortcuts='control+z'
      role='menuitem'
      aria-disabled={!canUndo}
    >
      <IconArrowBackUp
        color={`${canUndo ? 'black' : 'gray'}`}
        className="grid"
        width={16}
        height={16}
        aria-hidden="true"
      />
    </span>
  )
}

export function Redo({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  const canRedo = useEditorState({
    editor,
    selector: ctx => {
      return {
        canRedo: ctx.editor.can().redo(),
      };
    },
  });

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().redo().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().redo().run();
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().redo().run();
        }
      }}
      tabIndex={-1}
      aria-label={t("forms:text_editor_menu.redo")}
      aria-keyshortcuts='control+shift+z'
      role='menuitem'
      aria-disabled={!canRedo}
    >
      <IconArrowForwardUp
        color={`${canRedo ? 'black' : 'gray'}`}
        className="grid"
        width={16}
        height={16}
        aria-hidden="true"
      />
    </span>
  )
}

export function FontSize({
  editor,
  editorId,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor
  editorId: string,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState<boolean>(false);
  const [focusedFontSizeMenuItem, setFocusedFontSizeMenuItem] = useState<number | null>(null);

  const fontSizeMenuButtonRef = useRef<HTMLSpanElement>(null);
  const fontSizeMenuRef = useRef<HTMLUListElement | null>(null);
  const fontSizeMenuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);

  useEffect(() => {
    if (fontSizeMenuRef.current) {
      fontSizeMenuItemsRef.current = fontSizeMenuRef.current.querySelectorAll(
        "li > [role='menuitem'], li > [role='menuitemcheckbox'], li > [role='menuitemradio']"
      ) as NodeListOf<HTMLElement>;
    }
  }, [])

  const handleKeyDownFontSizeMenu = (e: React.KeyboardEvent<HTMLSpanElement>) => {
  
    if (!fontSizeMenuItemsRef.current) return;  

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!fontSizeMenuOpen) {
        setFontSizeMenuOpen(true);
        setFocusedFontSizeMenuItem(0);
      } else {
        setFontSizeMenuOpen(false);
        setFocusedFontSizeMenuItem(null);
      }
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()

      if (!fontSizeMenuOpen) {
        setFontSizeMenuOpen(true)
      }

      setFocusedFontSizeMenuItem(0)
    }

    if (e.key == 'Escape') {
      e.preventDefault()

      if (fontSizeMenuOpen) {
        e.stopPropagation();
        fontSizeMenuButtonRef.current?.focus();
        setFontSizeMenuOpen(false)
        setFocusedFontSizeMenuItem(null)
      }
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      setFontSizeMenuOpen(false)
      setFocusedFontSizeMenuItem(null)
    }

    if (e.key === 'Home') {
      setFontSizeMenuOpen(false);
      setFocusedFontSizeMenuItem(null);
    }

    if (e.key === 'End') {
      setFontSizeMenuOpen(false);
      setFocusedFontSizeMenuItem(null);
    }

  }

  const handleKeyDownFontSizeMenuItem = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!fontSizeMenuItemsRef.current) return;

    if (e.key === 'ArrowDown') {
      if (fontSizeMenuOpen && focusedFontSizeMenuItem != null) {
        e.preventDefault()

        if (focusedFontSizeMenuItem != fontSizeMenuItemsRef.current.length - 1) {
          setFocusedFontSizeMenuItem(focusedFontSizeMenuItem + 1)
        } else {
          setFocusedFontSizeMenuItem(0)
        }
      }
    }

    if (e.key === 'ArrowUp') {
      if (fontSizeMenuOpen && focusedFontSizeMenuItem != null) {
        e.preventDefault()

        if (focusedFontSizeMenuItem != 0) {
          setFocusedFontSizeMenuItem(focusedFontSizeMenuItem - 1)
        } else {
          setFocusedFontSizeMenuItem(fontSizeMenuItemsRef.current.length - 1)
        }
      }
    }

    if (e.key == 'Escape') {
      e.preventDefault()
      if (fontSizeMenuOpen) {
        e.stopPropagation();
        fontSizeMenuButtonRef.current?.focus();
        setFontSizeMenuOpen(false)
        setFocusedFontSizeMenuItem(null)
      }
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Tab' || e.key === 'End' || e.key === 'Home') {
      setFontSizeMenuOpen(false)
      setFocusedFontSizeMenuItem(null)
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedFontSizeMenuItem != null) {
        const itemEl = fontSizeMenuItemsRef.current[focusedFontSizeMenuItem];
        const selectedSize = itemEl?.getAttribute('data-size');
        if (selectedSize === 'unset') {
          editor.chain().focus().unsetFontSize().run();
        } else if (selectedSize) {
          editor.chain().focus().setFontSize(selectedSize).run();
        }
        setFontSizeMenuOpen(false);
        setFocusedFontSizeMenuItem(null);
        setFocusedMenubarItem(null);
      }
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (focusedFontSizeMenuItem != null) {
        const itemEl = fontSizeMenuItemsRef.current[focusedFontSizeMenuItem];
        const selectedSize = itemEl?.getAttribute('data-size');
        if (selectedSize === 'unset') {
          editor.chain().unsetFontSize().run();
        } else if (selectedSize) {
          editor.chain().setFontSize(selectedSize).run();
        }
      }
    }

    if (e.key === 'Home') {
      setFontSizeMenuOpen(false);
      setFocusedFontSizeMenuItem(null);
    }

    if (e.key === 'End') {
      setFontSizeMenuOpen(false);
      setFocusedFontSizeMenuItem(null);
    }

  }

  useEffect(() => {
    if (!fontSizeMenuItemsRef.current) return;

    if (focusedFontSizeMenuItem !== null) {
      const target = fontSizeMenuItemsRef.current[focusedFontSizeMenuItem] as HTMLElement | undefined;

      if (target) {
        target.focus();
      }
    }
  }, [focusedFontSizeMenuItem]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !(event.target instanceof Node) ||
        (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(event.target)) &&
        (fontSizeMenuButtonRef.current && !fontSizeMenuButtonRef.current.contains(event.target))
      ) {
        setFontSizeMenuOpen(false);
        editor.commands.focus()
      }
    };

    if (fontSizeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [fontSizeMenuOpen, editor]);

  return (
    <>
      <span
        data-menu-group={menuGroup}
        onClick={() => setFontSizeMenuOpen(!fontSizeMenuOpen)}
        onKeyDown={handleKeyDownFontSizeMenu}
        ref={fontSizeMenuButtonRef}
        tabIndex={-1}
        role='menuitem'
        aria-haspopup='menu'
        aria-expanded={fontSizeMenuOpen}
        aria-owns={`${editorId}-font-size-menu`} // TODO: Should you really have this?
        aria-label={t("forms:text_editor_menu.font_size.caption")}
        data-tooltip={t("forms:text_editor_menu.font_size.caption")}
        className='flex-important align-items-center justify-content-space-between' // TODO: Remove flex-important
        style={{width: '100px',}}
      >
        {!editor.getAttributes('textStyle').fontSize ?
          t("forms:text_editor_menu.font_size.normal")
          : editor.getAttributes('textStyle').fontSize == '1.25rem' ?
            t("forms:text_editor_menu.font_size.large")
            : editor.getAttributes('textStyle').fontSize == '0.75rem' ?
              t("forms:text_editor_menu.font_size.small")
              : ''
        }
        <IconChevronDown width={16} height={16} aria-hidden="true" />
      </span>
      <ul
        id={`${editorId}-font-size-menu`}
        ref={fontSizeMenuRef}
        aria-label={t("forms:text_editor_menu.font_size.caption")}
        role='menu'
        className={`
              ${styles["animated-menu"]} 
              ${fontSizeMenuOpen ? styles['visible'] : ''} 
              margin-0 padding-0 gray-95 smooth`
        }
      >
        <li role='presentation' style={{ borderBottom: '1px solid var(--gray)', paddingBottom: '2px' }}>
          <div
            onClick={() => { editor.chain().focus().setFontSize('1.25rem').run(), setFontSizeMenuOpen(false) }}
            onKeyDown={handleKeyDownFontSizeMenuItem}
            data-size="1.25rem"
            className='smooth font-size-smaller width-100'
            style={{ padding: '.5rem', whiteSpace: 'nowrap' }}
            role='menuitemradio'
            aria-label={t("forms:text_editor_menu.font_size.large")}
            aria-keyshortcuts='control+shift+1'
            aria-checked={editor.getAttributes('textStyle').fontSize === '1.25rem'}
            tabIndex={-1}>
            {t("forms:text_editor_menu.font_size.large")}
          </div>
        </li>
        <li role='presentation' style={{ borderBottom: '1px solid var(--gray)', paddingBlock: '2px' }}>
          <div
            onClick={() => { editor.chain().focus().unsetFontSize().run(), setFontSizeMenuOpen(false) }}
            onKeyDown={handleKeyDownFontSizeMenuItem}
            data-size="unset"
            className='smooth font-size-smaller width-100'
            style={{ padding: '.5rem', whiteSpace: 'nowrap' }}
            role='menuitemradio'
            aria-label={t("forms:text_editor_menu.font_size.normal")}
            aria-keyshortcuts='control+shift+2'
            aria-checked={!editor.getAttributes('textStyle').fontSize}
            tabIndex={-1}
          >
            {t("forms:text_editor_menu.font_size.normal")}
          </div>
        </li>
        <li role='presentation' style={{ paddingTop: '2px' }}>
          <div
            onClick={() => { editor.chain().focus().setFontSize('0.75rem').run(), setFontSizeMenuOpen(false) }}
            onKeyDown={handleKeyDownFontSizeMenuItem}
            data-size="0.75rem"
            className='smooth font-size-smaller width-100'
            style={{ padding: '.5rem', whiteSpace: 'nowrap' }}
            role='menuitemradio'
            aria-label={t("forms:text_editor_menu.font_size.small")}
            aria-keyshortcuts='control+shift+3'
            aria-checked={editor.getAttributes('textStyle').fontSize === '0.75rem'}
            tabIndex={-1}
          >
            {t("forms:text_editor_menu.font_size.small")}
          </div>
        </li>
      </ul>
    </>
  )
}

export function GreyText({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => { editor.getAttributes('textStyle').color !== 'grey' ? editor.chain().focus().setColor('grey').run() : editor.chain().focus().unsetColor().run() }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.getAttributes('textStyle').color !== 'grey' ? editor.chain().focus().setColor('grey').run() : editor.chain().focus().unsetColor().run();
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.getAttributes('textStyle').color !== 'grey' ? editor.chain().setColor('grey').run() : editor.chain().unsetColor().run();
        }
      }}
      tabIndex={-1}
      aria-label={t("forms:text_editor_menu.grey_text")}
      aria-keyshortcuts='control+shift+g'
      role='menuitemcheckbox'
      aria-checked={editor.getAttributes('textStyle').color === 'grey'}
    >
      <svg className='grid' aria-hidden='true' xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M9 15v-7a3 3 0 0 1 6 0v7" />
        <path d="M9 11h6" />
        <path d="M5 21h14" color='darkgrey' strokeWidth={3} />
      </svg>
    </span>
  )
}

export function Italic({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleItalic().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleItalic().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleItalic().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.italic")}
      aria-keyshortcuts='control+i'
      aria-checked={editor.getAttributes('textStyle').fontStyle === 'italic'}
    >
      <IconItalic className="grid" width={16} height={16} aria-hidden="true" />
    </span>
  )
}

export function Bold({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleBold().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleBold().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleBold().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.bold")}
      aria-keyshortcuts='control+b'
      aria-checked={editor.getAttributes('textStyle').fontWeight === 'bold'}
    >
      <IconBold className="grid" width={16} height={16} aria-hidden="true" />
    </span>
  )
}

export function StrikeThrough({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleLineThrough().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleLineThrough().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleLineThrough().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.strike_through")}
      aria-keyshortcuts='control+shift+s'
      aria-checked={editor.getAttributes('textStyle').textDecoration === 'line-through'}
    >
      <IconStrikethrough className="grid" width={16} height={16} aria-hidden="true" />
    </span>
  )
}

export function Underline({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleUnderline().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleUnderline().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleUnderline().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.underline")}
      aria-keyshortcuts='control+u'
      aria-checked={editor.getAttributes('textStyle').textDecoration === 'underline'}
    >
      <IconUnderline className="grid" width={16} height={16} aria-hidden="true" />
    </span>
  )
}

export function Superscript({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
   return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleSuperscript().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleSuperscript().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleSuperscript().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.superscript")}
      aria-keyshortcuts='control+.'
      aria-checked={editor.isActive('superscript')}
    >
      <IconSuperscript className="grid" width={16} height={16} aria-hidden="true" />
    </span>
  )
}

export function Subscript({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup} 
      onClick={() => editor.chain().focus().toggleSubscript().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleSubscript().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleSubscript().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.subscript")}
      aria-keyshortcuts='control+,'
      aria-checked={editor.isActive('subscript')}
    >
      <IconSubscript className="grid" width={16} height={16} aria-hidden="true" />
    </span>
  )
}

export function Highlight({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleHighlight().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleHighlight().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleHighlight().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.highlight")}
      aria-keyshortcuts='control+shift+h'
      aria-checked={editor.isActive('highlight')}
    >
      <IconHighlight className="grid" width={16} height={16} aria-hidden="true" />
    </span>
  )
}

// TODO: Export this as something else to avoid confusion with nextjs Link component
export function Link({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink()
        .run();

      return;
    }

    // update link
    let parsedUrl: URL | null = URL.parse(url);
    // If parsing fails, try to prepend the default protocol
    if (!parsedUrl) {
      parsedUrl = URL.parse(`https://${url}`);
    }
    // If parsing still fails, return
    if (!parsedUrl) {
      // TODO: i18n
      alert('Failed to parse URL.');
      return;
    }

    if (!allowedProtocols.includes(parsedUrl.protocol.replace(':', ''))) {
      // TODO: i18n
      alert(`Protocol "${parsedUrl.protocol.replace(':', '')}" is not allowed. Allowed protocols are: ${allowedProtocols.join(', ')}`);
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: parsedUrl.href })
      .run();
  }, [editor])

  return (
    <>
      <span
        data-menu-group={menuGroup}
        onClick={setLink} // TODO: Custom link menu :)
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            setLink();
            setFocusedMenubarItem(0)
          }
          if (e.key === ' ') {
            e.preventDefault();
            setLink();
          }
        }}
        tabIndex={-1}
        role='menuitemcheckbox'
        aria-label={t("forms:text_editor_menu.insert_link")}
        aria-checked={editor.isActive('link')}
      >
        <IconLink className="grid" width={16} height={16} aria-hidden="true" />
      </span>
      {editor &&
        <BubbleMenu 
          editor={editor} 
          options={{ placement: 'bottom', offset: 8 }} 
          shouldShow={({editor}) => editor.isActive('link')}
        >
          <div className="flex align-items-center padding-50 smooth gray-95" style={{boxShadow: '0 0 8px rgba(0,0,0,.25)'}}>
            <a 
              href={editor.getAttributes('link').href} 
              target="_blank" 
              style={{width: 'min(175px, auto)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {editor.getAttributes('link').href}
            </a>
            {/* TODO: Tooltips */}
            <button 
              type="button" 
              className="margin-left-100 padding-25 transparent round flex align-items-center"
              style={{transform: 'scale(1)'}} 
              aria-label="Kopiera länk"
              onClick={() => navigator.clipboard.writeText(editor.getAttributes('link').href)}
            > {/* TODO: I18n */}
              <IconCopy height={18} width={18} aria-hidden={true} />
            </button>
            <button 
              type="button" 
              className="padding-25 transparent round flex align-items-center"
              style={{transform: 'scale(1)'}} 
              aria-label="Redigera länk"
            > 
            {/* TODO: I18n */}
              <IconPencil height={18} width={18} aria-hidden={true} />
            </button>
            <span className="margin-left-25 padding-left-25" style={{borderLeft: '1px solid var(--gray)'}}>
              <button 
                type="button" 
                className="padding-25 transparent round flex align-items-center"
                style={{transform: 'scale(1)'}} 
                aria-label="Ta bort länk"
                onClick={() => editor.chain().focus().unsetLink().run()}
              > {/* TODO: I18n */}
                <IconLinkOff height={18} width={18} aria-hidden={true} />
              </button>
            </span>
          </div>
        </BubbleMenu>
      }
    </>
  )
}

export function BulletList({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleBulletList().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleBulletList().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleBulletList().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.bullet_list")}
      aria-keyshortcuts='control+shift+8'
      aria-checked={editor.isActive('bulletList')}
    >
      <IconList width={16} height={16} className="grid" aria-hidden='true' />
    </span>
  )
}

export function NumberedList({
  editor,
  setFocusedMenubarItem,
  menuGroup,
  t
}: {
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  menuGroup: number,
  t: TFunction<"forms", undefined>
}) {
  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleOrderedList().run()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.chain().focus().toggleOrderedList().run()
          setFocusedMenubarItem(0)
        }
        if (e.key === ' ') {
          e.preventDefault();
          editor.chain().toggleOrderedList().run();
        }
      }}
      tabIndex={-1}
      role='menuitemcheckbox'
      aria-label={t("forms:text_editor_menu.numbered_list")}
      aria-keyshortcuts='control+shift+7'
      aria-checked={editor.isActive('orderedList')}
    >
      <IconListNumbers width={16} height={16} className="grid" aria-hidden='true' />
    </span>
  )
}
'use client';

import { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { IconArrowBackUp, IconArrowForwardUp, IconItalic, IconBold, IconStrikethrough, IconUnderline, IconSuperscript, IconSubscript, IconHighlight, IconLink, IconList, IconListNumbers, IconChevronDown, IconLinkOff, IconPencil, IconAlignLeft } from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";
import styles from './textEditor.module.css' with { type: "css" }
import { allowedProtocols } from './config/config';
import { TFunction } from "i18next";
import { BubbleMenu } from '@tiptap/react/menus'
import { handleKeyDownPopUpMenu } from "./functions";
 
type MenubarButtonProps = {
  t: TFunction<"forms", undefined>;
  editor: Editor;
  menuGroup: number;
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>;
};

function handleKeyDownMenuItem(
  editor: Editor,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>,
  action: (chain: ReturnType<Editor['chain']>) => void
) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const chain = editor.chain().focus();
      action(chain);
      chain.run();
      setFocusedMenubarItem(null);
    }
    if (e.key === ' ') {
      e.preventDefault();
      const chain = editor.chain();
      action(chain);
      chain.run();
    }
  };
}

export function Undo(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

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
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.undo())}
      tabIndex={0}
      aria-label={t("forms:text_editor_menu.undo")}
      aria-keyshortcuts='control+z'
      role='menuitem'
      aria-disabled={!canUndo.canUndo}
    >
      <IconArrowBackUp
        color={`${canUndo.canUndo ? 'black' : 'gray'}`}
        className="grid"
        width={16}
        height={16}
        aria-hidden="true"
      />
    </span>
  )
}

export function Redo(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

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
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.redo())}
      tabIndex={-1}
      aria-label={t("forms:text_editor_menu.redo")}
      aria-keyshortcuts='control+shift+z'
      role='menuitem'
      aria-disabled={!canRedo.canRedo}
    >
      <IconArrowForwardUp
        color={`${canRedo.canRedo ? 'black' : 'gray'}`}
        className="grid"
        width={16}
        height={16}
        aria-hidden="true"
      />
    </span>
  )
}

export function GreyText(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => {
        if (editor.getAttributes('textStyle').color !== 'grey') {
          editor.chain().focus().setColor('grey').run();
        } else {
          editor.chain().focus().unsetColor().run();
        }
      }}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) =>
        editor.getAttributes('textStyle').color !== 'grey' ? chain.setColor('grey') : chain.unsetColor()
      )}
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

export function Italic(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleItalic().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleItalic())}
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

export function Bold(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleBold().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleBold())}
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

export function StrikeThrough(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleLineThrough().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleLineThrough())}
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

export function Underline(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleUnderline().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleUnderline())}
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

export function Superscript(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleSuperscript().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleSuperscript())}
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

export function Subscript(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleSubscript().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleSubscript())}
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

export function Highlight(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleHighlight().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleHighlight())}
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

export function BulletList(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleBulletList().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleBulletList())}
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

export function NumberedList(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  return (
    <span
      data-menu-group={menuGroup}
      onClick={() => editor.chain().focus().toggleOrderedList().run()}
      onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => chain.toggleOrderedList())}
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

// TODO: Export this as something else to avoid confusion with nextjs Link component?
export function Link(props: MenubarButtonProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem } = props;

  const [editLink, setEditLink] = useState<boolean>(false)
  const [textValue, setTextValue] = useState("");
  const [hrefValue, setHrefValue] = useState("");
  const linkNameRef = useRef<HTMLInputElement | null>(null)
  const linkHrefRef = useRef<HTMLInputElement | null>(null)
  const dialogref = useRef<HTMLDialogElement | null>(null)

  function setLink(text: string, url: string) {

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
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
      alert(t('forms:text_editor_menu.link.url_parse_error'));
      return;
    }

    if (!allowedProtocols.includes(parsedUrl.protocol.replace(':', ''))) {
      alert(t('forms:text_editor_menu.link.disallowed_protocol', { protocol: parsedUrl.protocol.replace(':', ''), allowedProtocols: allowedProtocols }));
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: parsedUrl.href }).run();
    editor
    .chain()
    .focus() 
    .insertContent(text)
    .run();
  } 

  // TODO: Fix keybindings both for adding links within this component and for opening the menu (ctrl + k)
  // TODO: The icon should never have aria-checked?
  // TODO: Move dialog outside the span
  return (
    <>
      <span
        data-menu-group={menuGroup}
          // onClick={() => {
          // If no link mark exists yet, create a placeholder link so BubbleMenu can show
         //    if (!editor.isActive('link')) {
          //     editor.chain().focus().setLink({ href: '' }).run(); // TODO: Set focus to menu.
          //   }
          // }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            editor.chain().focus().setLink({ href: '' }).run();
            setFocusedMenubarItem(null)
          }
        }}
        onClick={() => {
          dialogref.current?.showModal()
        }}
        tabIndex={-1}
        role='menuitemcheckbox'
        aria-label={t("forms:text_editor_menu.link.insert_link")}
        aria-checked={editor.isActive('link')}
        aria-keyshortcuts='control+k'
        style={{anchorName: '--test'}}
      >
        <IconLink className="grid" width={16} height={16} aria-hidden="true" />
        <dialog // TODO: remove dialog from the span
          closedby="any"
          ref={dialogref}
          className={`position-fixed padding-50 smooth gray-95 ${styles['link-menu']}`}    
          style={{ positionAnchor: '--test', top: 'anchor(bottom)', left: 'anchor(left)', margin: '.5rem 0 0 0', boxShadow: 'rgba(50, 50, 105, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.05) 0px 1px 1px 0px', border: '0' }} 
        >
          <div className="flex align-items-flex-end gap-25">
            <div>
              <label aria-label=""> {/* TODO: Label text + I18n */}
                <div className="focusable flex align-items-center padding-inline-25 margin-bottom-25">
                  <IconAlignLeft width={16} height={16} aria-hidden={true} />
                  <input
                    ref={linkNameRef}
                    className="padding-25"
                    type="text"
                    placeholder={t('forms:text_editor_menu.link.text_placeholder')}
                    title={t('forms:text_editor_menu.link.text_tooltip')}
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                  />
                </div>
              </label>
              <label aria-label=""> {/* TODO: Label text + I18n */}
                <div className="focusable flex align-items-center padding-inline-25">
                  <IconLink width={16} height={16} aria-hidden={true} />
                  <input
                    ref={linkHrefRef}
                    className="padding-25"
                    type="url"
                    placeholder={t('forms:text_editor_menu.link.url_placeholder')}
                    title={t('forms:text_editor_menu.link.url_tooltip')}
                    value={hrefValue}
                    onChange={(e) => setHrefValue(e.target.value)}
                  />
                </div>
              </label>
            </div>
            <button
              type="button"
              className="round transparent font-weight-600"
              style={{ color: 'var(--blue)' }}
              onClick={(e) => {e.stopPropagation(); setLink(textValue, hrefValue); dialogref.current?.close()}}
            >
              {t('forms:text_editor_menu.link.apply')}
            </button>
          </div>
        </dialog>

      </span>

      {editor &&
        <BubbleMenu 
          editor={editor}
          options={{
            placement: 'bottom',
            offset: 8,
            onUpdate: () => {
              if (editor.getAttributes('link').href) {
                setEditLink(false)
              } else {
                setEditLink(true)
              }
            },
          }}
          shouldShow={({ editor }) => editor.isActive('link')}
        >
          <div className="padding-50 smooth gray-95" style={{ boxShadow: 'rgba(50, 50, 105, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.05) 0px 1px 1px 0px' }}>
            {!editLink ?
              <div className="flex align-items-center">
                <a
                  href={(editor.getAttributes('link') as { href?: string | null }).href || ''}
                  target="_blank"
                  style={{ width: 'min(175px, auto)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {editor.getAttributes('link').href}
                </a>
                {/* <button
                  type="button"
                  className={`padding-25 margin-left-100 transparent rounded flex align-items-center ${styles.tooltip}`}
                  style={{ transform: 'scale(1)' }}
                  aria-label={t('forms:text_editor_menu.link.edit_link')}
                  data-tooltip={t('forms:text_editor_menu.link.edit_link')}
                  onClick={() => setEditLink(true)}
                >
                  <IconPencil height={18} width={18} aria-hidden={true} />
                </button> */}
                <span className="margin-left-75 padding-left-25" style={{ borderLeft: '1px solid var(--gray)' }}>
                  <button
                    type="button"
                    className={`padding-25 transparent rounded flex align-items-center ${styles.tooltip}`}
                    style={{ transform: 'scale(1)' }}
                    aria-label={t('forms:text_editor_menu.link.remove_link')}
                    data-tooltip={t('forms:text_editor_menu.link.remove_link')}
                    onClick={() => { editor.chain().focus().unsetLink().run() }}
                  >
                    <IconLinkOff height={18} width={18} aria-hidden={true} />
                  </button>
                </span>
              </div>
              :
              <>
                <div className="flex align-items-flex-end gap-25">
                  <div>
                    <label aria-label=""> {/* TODO: Label text + I18n */}
                      <div className="focusable flex align-items-center padding-inline-25 margin-bottom-25">
                        <IconAlignLeft width={16} height={16} aria-hidden={true} />
                        <input
                          ref={linkNameRef}
                          className="padding-25"
                          type="text"
                          placeholder={t('forms:text_editor_menu.link.text_placeholder')}
                          title={t('forms:text_editor_menu.link.text_tooltip')}
                          value={textValue}
                          onChange={(e) => setTextValue(e.target.value)}
                        />
                      </div>
                    </label>
                    <label aria-label=""> {/* TODO: Label text + I18n */}
                      <div className="focusable flex align-items-center padding-inline-25">
                        <IconLink width={16} height={16} aria-hidden={true} />
                        <input
                          ref={linkHrefRef}
                          className="padding-25"
                          type="url"
                          placeholder={t('forms:text_editor_menu.link.url_placeholder')}
                          title={t('forms:text_editor_menu.link.url_tooltip')}
                          value={hrefValue}
                          onChange={(e) => setHrefValue(e.target.value)}
                        />
                      </div>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="round transparent font-weight-600"
                    style={{ color: 'var(--blue)' }}
                    onClick={() => setLink(textValue, hrefValue)}
                  >
                    {t('forms:text_editor_menu.link.apply')}
                  </button>
                </div>
              </>
            }
          </div>
        </BubbleMenu>
      }
    </>
  )
}

type FontSizeProps = MenubarButtonProps & { editorId: string };
export function FontSize(props: FontSizeProps) {
  const { t, editor, menuGroup, setFocusedMenubarItem, editorId } = props;

  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState<boolean>(false);
  const [focusedFontSizeMenuItem, setFocusedFontSizeMenuItem] = useState<number | null>(null);

  const fontSizeMenuButtonRef = useRef<HTMLSpanElement>(null);
  const fontSizeMenuRef = useRef<HTMLUListElement | null>(null);
  const fontSizeMenuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);

  useEffect(() => {
    if (fontSizeMenuRef.current) {
      fontSizeMenuItemsRef.current = fontSizeMenuRef.current.querySelectorAll(
        "li > [role='menuitem'], li > [role='menuitemcheckbox'], li > [role='menuitemradio']"
      );
    }
  }, [])

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
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setFontSizeMenuOpen(true)
            setFocusedFontSizeMenuItem(0)
          }
        }}
        ref={fontSizeMenuButtonRef}
        tabIndex={-1}
        role='menuitem'
        aria-haspopup='menu'
        aria-expanded={fontSizeMenuOpen}
        aria-label={t("forms:text_editor_menu.font_size.caption")}
        data-tooltip={t("forms:text_editor_menu.font_size.caption")}
        className='flex-important align-items-center justify-content-space-between position-relative'
        style={{ width: '100px', lineHeight: '1' }}
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
          style={{
            boxShadow: 'rgba(50, 50, 105, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.05) 0px 1px 1px 0px',
            fontSize: '1rem'
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLUListElement>) => {
            if (!fontSizeMenuButtonRef.current || !fontSizeMenuItemsRef.current || !fontSizeMenuOpen) return

            handleKeyDownPopUpMenu(
              e,
              editor,
              fontSizeMenuButtonRef.current,
              fontSizeMenuItemsRef.current,
              focusedFontSizeMenuItem,
              setFocusedFontSizeMenuItem,
              setFontSizeMenuOpen,
              setFocusedMenubarItem
            )
          }}
        >
          <li role='presentation' style={{ borderBottom: '1px solid var(--gray)', paddingBottom: '2px' }}>
            <div
              onClick={() => { editor.chain().focus().setFontSize('1.25rem').run(); setFontSizeMenuOpen(false) }}
              // onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => {chain.setFontSize('1.25rem'); setFontSizeMenuOpen(false)})}
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
              onClick={() => { editor.chain().focus().unsetFontSize().run(); setFontSizeMenuOpen(false) }}
              // onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => {chain.unsetFontSize(); setFontSizeMenuOpen(false)})}
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
              onClick={() => { editor.chain().focus().setFontSize('0.75rem').run(); setFontSizeMenuOpen(false) }}
              // onKeyDown={handleKeyDownMenuItem(editor, setFocusedMenubarItem, (chain) => {chain.setFontSize('0.75rem'); setFontSizeMenuOpen(false)})}
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
      </span>
    </>
  )
}
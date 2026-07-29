'use client';

import { commentSorter } from "@/lib/sorters";
import type { Comments as CommentModel } from "@/lib/prisma/generated";
import styles from './comments.module.css';
import type { FocusEventHandler, InputEventHandler } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import formSubmitter from "@/functions/formSubmitter";

export default function Comments({ comments, objectId }: { comments?: (CommentModel & { author: { id: string, username: string } | null })[], objectId: string }) {
  const { t } = useTranslation(["components", "common"]);

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.target.elements;
    const comment = (form.namedItem("comment") as HTMLInputElement)?.value;
    const formJSON = JSON.stringify({
      commentText: comment,
      objectId,
    });
    formSubmitter(
      '/api/comment',
      formJSON,
      'POST',
      t,
      undefined,
      undefined,
      () => {
        window.location.reload();
      },
      (err) => {
        if (err instanceof Object && 'message' in err && typeof err.message === 'string') {
          alert(t("common:error.generic_with_details", { details: err.message }));
        } else {
          console.error('Unexpected error:', err);
          alert(t("common:error.generic_with_details", { details: 'See console for details' }));
        }
      },
    );
  }

  // Sort comments by date
  comments?.sort(commentSorter);

  /* Handle input from span */
  const [editedContent, setEditedContent] = useState('');
  const handleInput: InputEventHandler<HTMLSpanElement> = (event) => {
    setEditedContent(event.currentTarget.innerText);
  };

  const handleBlur: FocusEventHandler<HTMLSpanElement> = (event) => {
    setEditedContent(event.currentTarget.innerText);
  };

  const spanRef = useRef<HTMLSpanElement>(null);
  const removeText = () => {
    if (spanRef.current) {
      spanRef.current.innerHTML = '';
    }
    setEditedContent('');
  };

  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const expandComment = (commentId: string) => {
    setExpandedComments((prevExpandedComments) => {
      if (prevExpandedComments.includes(commentId)) {
        return prevExpandedComments.filter((id) => id !== commentId);
      } else {
        return [...prevExpandedComments, commentId];
      }
    });
  };

  return (
    <div className="container-text">
        <h2>{t("components:comments.comment_count", { count: comments?.length ?? 0 })}</h2>
        <form onSubmit={handleSubmit}>
          <span className={styles.textarea} role="textbox" id="comment-text" contentEditable={true} aria-label={t("components:comments.add_comment")} aria-placeholder={t("components:comments.add_comment")} onInput={handleInput} onBlur={handleBlur} ref={spanRef}></span>
          <input type="hidden" name="comment" id="comment" value={editedContent} />
          <div className="display-flex justify-content-flex-end gap-50 padding-block-50">
            <button type="button" disabled={!editedContent} className={`${styles.button} ${styles.cancel}`} onClick={removeText}>{t("common:tsx.cancel")}</button>
            <button type="submit" disabled={!editedContent} className={`${styles.button} ${styles.comment}`}>{t("components:comments.send")}</button>
          </div>
        </form>
        {comments?.map((comment) => (
          <div key={comment.id}>
            <div className="flex align-items-center gap-50 margin-top-200">
              {comment.author ? (
                <Link className={styles.commentAuthor} href={`/@${comment.author.username}`}>{comment.author.username}</Link>
              ) : (
                // Authors are nullable (deleted users)
                <span className={styles.commentAuthor}>{t("components:comments.deleted_user")}</span>
              )}
              <span className="font-weight-300" style={{ color: 'gray', fontSize: '.75rem' }} title={new Date(comment.created_at).toLocaleString()}>
                {t("components:comments.relative_time", { date: new Date(comment.created_at) })}
              </span>
            </div>
            <p className="margin-0" style={{ wordBreak: 'break-word' }}>
              {expandedComments.includes(comment.id) ? comment.comment_text : comment.comment_text.length > 300 ? `${comment.comment_text.substring(0, 300)}${t("common:tsx.ellipsis")}` : comment.comment_text}
            </p>
            {comment.comment_text.length > 300 ?
              <button type="button" className={`margin-block-25 ${styles.readMoreButton}`} onClick={() => expandComment(comment.id)}>
                {expandedComments.includes(comment.id) ? t("common:tsx.show_less") : t("common:tsx.show_more")}
              </button>
              : null}
          </div>
        ))}
      </div>
  );
}
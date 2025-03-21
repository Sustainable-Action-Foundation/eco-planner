'use client';

import { commentSorter } from "@/lib/sorters";
import { Comment } from "@prisma/client";
import styles from './comments.module.css'
import { ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export default function Comments({ comments, objectId }: { comments?: (Comment & { author: { id: string, username: string } })[], objectId: string }) {
  const { t } = useTranslation();

  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.target.elements
    const comment = (form.namedItem("comment") as HTMLInputElement)?.value
    const formJSON = JSON.stringify({
      commentText: comment,
      objectId,
    })
    fetch('/api/comment', {
      method: 'POST',
      body: formJSON,
      headers: { 'Content-Type': 'application/json' },
    }).then((res) => {
      if (res.ok) {
        return res.json()
      } else {
        return res.json().then((data) => {
          throw new Error(data.message)
        })
      }
    }).then(() => {
      window.location.reload()
    }).catch((err) => {
      alert(err.message)
    });
  }

  // Sort comments by date
  comments?.sort(commentSorter);

  /* Handle input from span */
  const [editedContent, setEditedContent] = useState('');
  const handleInput = (event: ChangeEvent<HTMLSpanElement>) => {
    setEditedContent(event.target.innerText);
  };

  const spanRef = useRef<HTMLSpanElement>(null);
  const removeText = () => {
    if (spanRef.current) {
      spanRef.current.innerHTML = ''
    }
    setEditedContent('')
  }

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
    <>
      <div className="container-text">
        <h2>{t("components:comments.comment_count", { count: comments?.length || 0 })}</h2>
        <form onSubmit={handleSubmit}>
          <span className={styles.textarea} role="textbox" id="comment-text" contentEditable aria-label={t("components:comments.add_comment")} aria-placeholder={t("components:comments.add_comment")} onInput={handleInput} onBlur={handleInput} ref={spanRef}></span>
          <input type="hidden" name="comment" id="comment" value={editedContent} />
          <div className="display-flex justify-content-flex-end gap-50 padding-block-50">
            <button type="button" disabled={!editedContent} className={`${styles.button} ${styles.cancel}`} onClick={removeText}>{t("components:comments.cancel")}</button>
            <button type="submit" disabled={!editedContent} className={`${styles.button} ${styles.comment}`}>{t("components:comments.send")}</button>
          </div>
        </form>
        {comments?.map((comment) => (
          <div key={comment.id}>
            <div className="flex align-items-center gap-50 margin-top-200">
              <a className={styles.commentAuthor} href={`/@${comment.author.username}`}>{comment.author.username}</a>
              <span className="font-weight-300" style={{ color: 'gray', fontSize: '.75rem' }}>
                {t("components:comments.relative_time", { date: new Date(comment.createdAt) })}
              </span>
            </div>
            <p className="margin-0" style={{ wordBreak: 'break-word', }}>
              {expandedComments.includes(comment.id) ? comment.commentText : comment.commentText.length > 300 ? `${comment.commentText.substring(0, 300)}${t("common:ellipsis")}` : comment.commentText}
            </p>
            {comment.commentText.length > 300 ?
              <button className={`margin-block-25 ${styles.readMoreButton}`} onClick={() => expandComment(comment.id)}>
                {expandedComments.includes(comment.id) ? t("components:comments.show_less") : t("components:comments.show_more")}
              </button>
              : null}
          </div>
        ))}
      </div>
    </>
  )
}
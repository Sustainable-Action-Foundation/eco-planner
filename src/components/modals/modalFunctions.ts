'use client';

export function closeModal(modalRef: React.RefObject<HTMLDialogElement | null>) {
  modalRef.current?.close();
}

export function openModal(modalRef: React.RefObject<HTMLDialogElement | null>) {
  modalRef.current?.showModal();
}
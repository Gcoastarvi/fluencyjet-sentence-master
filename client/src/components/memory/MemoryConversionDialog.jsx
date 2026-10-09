import { useEffect, useId, useRef } from "react";

export default function MemoryConversionDialog({
  title,
  description,
  onClose,
  children,
  contentClassName = "",
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!dialog.open) dialog.showModal();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  function dismiss() {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose?.();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      className={`m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/70 sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] ${contentClassName || "max-w-xl"}`}
    >
      <div className="relative p-5 sm:p-8">
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:right-6 sm:top-6"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="pr-10 sm:pr-12">
          <h2 id={titleId} className="text-2xl font-black tracking-tight sm:text-3xl">
            {title}
          </h2>
          <p id={descriptionId} className="mt-3 font-medium leading-7 text-slate-600">
            {description}
          </p>
        </div>
        {children}
      </div>
    </dialog>
  );
}

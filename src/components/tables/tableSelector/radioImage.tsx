import styles from '../tables.module.css' with { type: "css" };

export default function RadioImage({
  value,
  name,
  checked,
  children,
  onChange,
  disabled,
}: {
  value: string,
  name: string,
  checked: boolean,
  children: React.ReactNode,
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean,
}) {

  return (
    <label className={`button transparent font-weight-bold flex align-items-center gap-50 smooth ${styles.radioImageWrapper}`}>
      <input type='radio' name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} />
      {children}
    </label>
  );
}
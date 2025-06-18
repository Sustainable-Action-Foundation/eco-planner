import styles from '../tables.module.css' with { type: "css" };

export default function RadioImage({
  value,
  name, 
  checked,
  children,
  onChange,
}: {
  value: string,
  name: string,
  checked: boolean,
  children: React.ReactNode,
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  
  return (
    <>
      <label className={`button transparent font-weight-bold flex align-items-center gap-50 smooth ${styles.radioImageWrapper}`}>
        <input type='radio' name={name} value={value} checked={checked} onChange={onChange}/>
        {children}
      </label>
    </>
  )
}
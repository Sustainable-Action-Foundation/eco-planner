import styles from '../graphs.module.css' with { type: "css" };

export default function RadioImage({
  value,
  name, 
  checked,
  text,
  onChange,
}: {
  value: string,
  name: string,
  checked: boolean,
  text: string,
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {


  return (
    <>
      <label className={`padding-50 transparent smooth ${styles.radioImageWrapper}`}>
        {text}
        <input type='radio' name={name} value={value} checked={checked} onChange={onChange}/>
      </label>
    </>
  )
}
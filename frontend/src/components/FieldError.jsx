export default function FieldError({ name, errors }) {
  return errors[name] ? <p id={`${name}-error`} className="field-error" aria-live="polite">{errors[name]}</p> : null;
}

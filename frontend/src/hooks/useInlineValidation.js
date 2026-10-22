import { useState } from "react";

export function validateFields(form) {
  const errors = {};
  const fields = Array.from(form.elements).filter((field) => field.name && !field.disabled);
  for (const field of fields) {
    const value = field.value;
    if (field.required && !value.trim()) errors[field.name] = field.dataset.requiredMessage || "Vui lòng nhập thông tin này.";
    else if (value && field.type === "email" && field.validity.typeMismatch) errors[field.name] = "Email không đúng định dạng.";
    else if (value && field.minLength > 0 && value.length < field.minLength) errors[field.name] = `Mật khẩu phải có ít nhất ${field.minLength} ký tự.`;
    else if (field.maxLength > 0 && value.length > field.maxLength) errors[field.name] = `Vui lòng nhập tối đa ${field.maxLength} ký tự.`;
  }
  const confirmation = fields.find((field) => field.name === "confirmPassword");
  const password = fields.find((field) => field.name === "newPassword" || field.name === "password");
  if (confirmation && password && !errors.confirmPassword && confirmation.value !== password.value)
    errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
  return errors;
}

export default function useInlineValidation() {
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  function validate(form) {
    const next = validateFields(form);
    setSubmitted(true);
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) form.elements.namedItem(first)?.focus();
    return !first;
  }
  function onChange(event) {
    if (submitted) setErrors(validateFields(event.currentTarget));
  }
  function reset() { setErrors({}); setSubmitted(false); }
  function fieldProps(name) {
    return { "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `${name}-error` : undefined };
  }
  return { errors, validate, onChange, reset, fieldProps };
}

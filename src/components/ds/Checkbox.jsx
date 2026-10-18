'use client';
import React from 'react';
import { Checkbox as AntCheckbox } from 'antd';

/* antd Checkbox. onChange receives an event whose `target.checked` is the new
   state (same shape as the native input event callers used before). */
export function Checkbox({ label, checked, indeterminate = false, disabled = false, onChange, ...rest }) {
  return (
    <AntCheckbox checked={checked} indeterminate={indeterminate} disabled={disabled} onChange={onChange} {...rest}>
      {label}
    </AntCheckbox>
  );
}

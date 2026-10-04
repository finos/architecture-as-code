import React, { useId, useState } from 'react';

// Standard suggestions from CALM release 1.0–1.2 meta/core.json in the reference checkout.
export const NODE_TYPES = ['actor', 'ecosystem', 'system', 'service', 'database', 'network', 'ldap', 'webclient', 'data-asset'];
export const PROTOCOLS = ['HTTP', 'HTTPS', 'FTP', 'SFTP', 'JDBC', 'WebSocket', 'SocketIO', 'LDAP', 'AMQP', 'TLS', 'mTLS', 'TCP'];

export function SuggestedField({ label, value, options, required = false, onChange }: {
  label: string; value: string; options: string[]; required?: boolean; onChange: (value: string) => void;
}) {
  const id = useId();
  const [custom, setCustom] = useState(value !== '' && !options.includes(value));
  const [customValue, setCustomValue] = useState(custom ? value : '');
  return <>
    <label htmlFor={id}>{label}</label>
    <select id={id} value={custom ? '__custom__' : value} required={required} onChange={event => {
      const next = event.target.value;
      if (next === '__custom__') { setCustom(true); onChange(customValue); }
      else { setCustom(false); onChange(next); }
    }}>
      <option value="">{required ? 'Choose a value' : 'Not specified'}</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
      <option value="__custom__">Custom…</option>
    </select>
    {custom && <label>{label} (custom)<input value={value} required={required} onChange={event => {
      setCustomValue(event.target.value); onChange(event.target.value);
    }}/></label>}
  </>;
}

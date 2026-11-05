'use client';
import { Field } from './ui';

export type StudentValues = {
  fullName: string; srn: string; deptId: string; cgpa: string; backlogCount: string; gradYear: string;
};
export type Dept = { dept_id: number; code: string; name: string };

/** Shared by the registration form and the profile page so both validate and look the same. */
export default function StudentFields({ values, onChange, errors = {}, depts, srnReadOnly, idPrefix = 'sf' }: {
  values: StudentValues; onChange: (k: keyof StudentValues, v: string) => void; errors?: Record<string, string>;
  depts: Dept[]; srnReadOnly?: boolean; idPrefix?: string;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const inv = (k: string) => (errors[k] ? true : undefined);
  const d = (k: string) => (errors[k] ? `${id(k)}-err` : undefined);
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row">
        <Field label="Full name" htmlFor={id('fullName')} error={errors.fullName}>
          <input id={id('fullName')} required value={values.fullName} maxLength={100} aria-invalid={inv('fullName')} aria-describedby={d('fullName')}
            onChange={(e) => onChange('fullName', e.target.value)} autoComplete="name" />
        </Field>
        <Field label="SRN" htmlFor={id('srn')} error={errors.srn} help={srnReadOnly ? 'Your SRN cannot be changed. Contact the placement cell if it is wrong.' : 'Looks like PES1UG24CS101'}>
          <input id={id('srn')} required value={values.srn} readOnly={srnReadOnly} placeholder="PES1UG24CS101" aria-invalid={inv('srn')} aria-describedby={d('srn')}
            onChange={(e) => onChange('srn', e.target.value.toUpperCase())} />
        </Field>
      </div>
      <div className="row">
        <Field label="Department" htmlFor={id('deptId')} error={errors.deptId}>
          <select id={id('deptId')} required value={values.deptId} aria-invalid={inv('deptId')} aria-describedby={d('deptId')}
            onChange={(e) => onChange('deptId', e.target.value)}>
            <option value="">Select...</option>
            {depts.map((x) => <option key={x.dept_id} value={x.dept_id}>{x.code} - {x.name}</option>)}
          </select>
        </Field>
        <Field label="Graduation year" htmlFor={id('gradYear')} error={errors.gradYear}>
          <input id={id('gradYear')} type="number" min={2024} max={2035} required value={values.gradYear} aria-invalid={inv('gradYear')} aria-describedby={d('gradYear')}
            onChange={(e) => onChange('gradYear', e.target.value)} />
        </Field>
      </div>
      <div className="row">
        <Field label="CGPA" htmlFor={id('cgpa')} error={errors.cgpa} help="0 to 10, up to 2 decimals">
          <input id={id('cgpa')} type="number" step="0.01" min={0} max={10} required value={values.cgpa} aria-invalid={inv('cgpa')} aria-describedby={d('cgpa')}
            onChange={(e) => onChange('cgpa', e.target.value)} />
        </Field>
        <Field label="Active backlogs" htmlFor={id('backlogCount')} error={errors.backlogCount}>
          <input id={id('backlogCount')} type="number" min={0} step={1} required value={values.backlogCount} aria-invalid={inv('backlogCount')} aria-describedby={d('backlogCount')}
            onChange={(e) => onChange('backlogCount', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

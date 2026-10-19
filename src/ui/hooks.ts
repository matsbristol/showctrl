/*
 * Contexts and hooks for app-wide UI: toasts and the form dialog.
 * Kept apart from the provider components so fast refresh keeps working.
 */
import { createContext, useContext } from 'react'
import type { Ms } from '../types/model'

/* ---------------- toasts ---------------- */

export interface ToastAction {
  label: string
  run: () => void | Promise<void>
}

/** Shows a short message; with an action it stays longer and offers a button. */
export type ShowToast = (text: string, action?: ToastAction) => void

export const ToastContext = createContext<ShowToast | null>(null)

export function useToast(): ShowToast {
  const t = useContext(ToastContext)
  if (!t) throw new Error('useToast must be used inside <ToastProvider>')
  return t
}

/* ---------------- form dialog ---------------- */

export type FieldValue = string | Ms | null | string[]
export type FormValues = Record<string, FieldValue>

interface FieldBase {
  /** Key in the form values. */
  k: string
  label: string
  /** Span both columns. */
  full?: boolean
  placeholder?: string
  /** Hide the field unless this returns true for the current values. */
  show?: (v: FormValues) => boolean
}

/**
 * Field types. Values: text, number, textarea and select are strings
 * (convert in onSave, as with any form input); date is a `YYYY-MM-DD` day
 * key; datetime is epoch ms in the event time zone, or null; checks is the
 * list of ticked option keys.
 */
export type FieldDef =
  | (FieldBase & { type?: 'text' | 'number' | 'textarea' | 'date' | 'datetime' })
  | (FieldBase & { type: 'select' | 'checks'; options: [string, string][] })
  | { type: 'note'; k: string; text: string; full?: boolean; show?: (v: FormValues) => boolean }

export interface FormDef {
  title: string
  fields: FieldDef[]
  values: FormValues
  saveLabel?: string
  /** Return a message to show it and keep the dialog open; anything else closes it. */
  onSave: (v: FormValues) => Promise<string | void> | string | void
  /** Shows a Delete button that asks once more before calling this. */
  onDelete?: () => Promise<void> | void
}

export type OpenForm = (def: FormDef) => void

export const FormContext = createContext<OpenForm | null>(null)

export function useForm(): OpenForm {
  const f = useContext(FormContext)
  if (!f) throw new Error('useForm must be used inside <FormProvider>')
  return f
}

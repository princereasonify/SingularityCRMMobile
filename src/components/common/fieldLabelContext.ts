import { createContext } from 'react';

/**
 * True while rendering inside a crud <Field> that already prints a label. NumField reads it so
 * it shows its OWN `label` above the field only when nothing else does — screens that pass
 * `label` straight to NumField (Deal Estimate, Create Deal, Targets…) used to render a bare box
 * whose label only appeared inside the pop-up keypad, while screens that wrap it in
 * <Field label> must not get the label twice.
 */
export const FieldLabelContext = createContext(false);

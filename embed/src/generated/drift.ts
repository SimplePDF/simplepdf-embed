// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
import type { IframeBridge } from '../types'
import type * as Schemas from './schemas'
import type * as Contract from './contract'

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type AssertTrue<T extends true> = T

// IframeBridge method set must exactly equal the generated operation methods,
// and each zod schema must stay mutually assignable to its plain contract type.
export type DriftGuards = [
  AssertTrue<Exact<Exclude<keyof IframeBridge, 'getState'>, Contract.MethodName>>,
  AssertTrue<Exact<Schemas.CreateFieldInput, Contract.CreateFieldInput>>,
  AssertTrue<Exact<Schemas.DeleteFieldsInput, Contract.DeleteFieldsInput>>,
  AssertTrue<Exact<Schemas.DeletePagesInput, Contract.DeletePagesInput>>,
  AssertTrue<Exact<Schemas.DetectFieldsInput, Contract.DetectFieldsInput>>,
  AssertTrue<Exact<Schemas.DownloadInput, Contract.DownloadInput>>,
  AssertTrue<Exact<Schemas.FocusFieldInput, Contract.FocusFieldInput>>,
  AssertTrue<Exact<Schemas.GetDocumentContentInput, Contract.GetDocumentContentInput>>,
  AssertTrue<Exact<Schemas.GetFieldsInput, Contract.GetFieldsInput>>,
  AssertTrue<Exact<Schemas.GoToInput, Contract.GoToInput>>,
  AssertTrue<Exact<Schemas.LoadDocumentInput, Contract.LoadDocumentInput>>,
  AssertTrue<Exact<Schemas.MovePageInput, Contract.MovePageInput>>,
  AssertTrue<Exact<Schemas.RotatePageInput, Contract.RotatePageInput>>,
  AssertTrue<Exact<Schemas.SelectToolInput, Contract.SelectToolInput>>,
  AssertTrue<Exact<Schemas.SetFieldValueInput, Contract.SetFieldValueInput>>,
  AssertTrue<Exact<Schemas.SubmitInput, Contract.SubmitInput>>,
]

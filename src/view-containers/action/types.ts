import {
  Criteria,
  DataContext,
  DataRecord,
} from "@/services/client/data.types";
import { ActionResult } from "@/services/client/meta";

export interface IActionData {
  type: string;
}

export interface ActionAttrsData extends IActionData {
  type: "attrs";
  attrs: {
    target: string;
    name: string;
    value: any;
  }[];
}

export interface ActionValueData extends IActionData {
  type: "value";
  target: string;
  value: any;
  op: "set" | "add" | "del";
}

export interface ActionRecordData extends IActionData {
  type: "record";
  value: DataRecord;
}

export interface ActionFocusData extends IActionData {
  type: "focus";
  target: string;
}

export interface ActionCloseData extends IActionData {
  type: "close";
}

export type ActionData =
  | ActionAttrsData
  | ActionValueData
  | ActionFocusData
  | ActionCloseData
  | ActionRecordData;

export type ActionListener = (data: ActionData) => void;

export interface ActionHandler {
  setAttrs(attrs: ActionAttrsData["attrs"]): any;
  setFocus(target: string): void;

  setValue(name: string, value: any): void;
  addValue(name: string, value: any): void;
  delValue(name: string, value: any): void;

  setValues(values: DataRecord): Promise<void>;

  save(record?: DataRecord): Promise<void>;
  edit(record?: DataRecord | null): Promise<void>;

  validate(): Promise<void>;

  refresh(target?: string): Promise<void>;

  close(): Promise<void>;

  getContext(): DataContext;

  onSignal(signal: string, data?: any): Promise<void>;

  subscribe(subscriber: ActionListener): () => void;

  notify(data: ActionData): void;
}

export type ActionOptions = {
  data?: Criteria & {
    _domain?: string;
    _domainContext?: DataContext;
    _archived?: boolean;
  };
  context?: DataContext;
  enqueue?: boolean;
};

export interface ActionExecutor {
  execute(
    action: string,
    options?: ActionOptions,
  ): Promise<ActionResult[] | void>;
  wait(): Promise<void>;
  waitFor(interval?: number): Promise<void>;
}

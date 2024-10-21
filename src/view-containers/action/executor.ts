import uniqueId from "lodash/uniqueId";
import isEmpty from "lodash/isEmpty";

import { alerts } from "@/components/alerts";
import { dialogs } from "@/components/dialogs";
import { block } from "@/components/http-watch/use-block";
import {
  closeTab_internal as closeTab,
  openTab_internal as openTab,
} from "@/hooks/use-tabs";
import { getActivePopups, getActiveTabId } from "@/layout/nav-tabs/utils";
import { i18n } from "@/services/client/i18n";
import { ActionResult, action as actionRequest } from "@/services/client/meta";
import { ActionView, HtmlView, View } from "@/services/client/meta.types";
import { download } from "@/utils/download";

import { TaskQueue } from "./queue";
import {
  ActionAttrsData,
  ActionExecutor,
  ActionHandler,
  ActionOptions,
} from "./types";

const queue = new TaskQueue();

const executeAction: typeof actionRequest = async (options) => {
  return block(() => actionRequest(options).then(processActionResult));
};

const processActionResult = (result: ActionResult[]): ActionResult[] => {
  let actionValueResult: ActionResult["values"] = {};
  const actionAttrResult: ActionResult["attrs"] = {};
  const otherResults: ActionResult[] = [];

  result.forEach((res) => {
    const { attrs, values, ...rest } = res;
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v && typeof v === "object" && "value" in v) {
          actionValueResult![k] = v.value;
        } else {
          actionAttrResult![k] = {
            ...actionAttrResult?.[k],
            ...v,
          };
        }
      });
    }
    if (values) {
      actionValueResult = { ...actionValueResult, ...values };
    }
    if (!isEmpty(rest)) {
      otherResults.push(rest);
    }
  });

  return [
    ...(isEmpty(actionAttrResult) ? [] : [{ attrs: actionAttrResult }]),
    ...(isEmpty(actionValueResult) ? [] : [{ values: actionValueResult }]),
    ...otherResults,
  ] as ActionResult[];
};

export class DefaultActionExecutor implements ActionExecutor {
  #handler;

  constructor(handler: ActionHandler) {
    this.#handler = handler;
  }

  #ensureLast(actions: string[], name: string) {
    const index = actions.indexOf(name);
    const length = actions.length;

    if (index > -1 && index !== length - 1) {
      throw new Error(
        i18n.get('Invalid use of "{0}" action, must be the last action.', name),
      );
    }

    return index > -1;
  }

  #enqueue(action: string, options?: ActionOptions) {
    return queue.add(() => this.#execute(action, options));
  }

  async waitFor(interval = 50) {
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), interval);
    });
  }

  async wait() {
    return queue.wait();
  }

  async execute(action: string, options?: ActionOptions) {
    const { enqueue = true, ...opts } = options ?? {};
    try {
      return enqueue
        ? await this.#enqueue(action, opts)
        : await this.#execute(action, opts);
    } catch (e) {
      const message =
        typeof e === "string" ? e : e instanceof Error ? e.message : null;
      if (message) {
        dialogs.error({
          content: message,
        });
      }
      return Promise.reject(e);
    }
  }

  async #execute(action: string, options?: ActionOptions) {
    const actions = action
      .split(",")
      .map((x) => x.trim())
      .filter((x) => {
        // we may not need `sync` now
        if (x === "sync") {
          console.warn(
            `We don't need "sync" action now, remove it from: ${action}`,
          );
          return false;
        }
        return true;
      })
      .filter(Boolean);

    if (actions.length === 0) {
      return;
    }

    // `new` and `close` must be the last action
    this.#ensureLast(actions, "new");
    this.#ensureLast(actions, "close");

    // re-join to remove white spaces<
    action = actions.join(",");

    if (action === "close") {
      this.#closeView();
      return this.#handler.close();
    }

    if (action === "new") {
      return this.#handler.edit(null);
    }

    if (action === "validate") {
      return this.#handler.validate();
    }

    if (action === "save") {
      return this.#handler.save();
    }

    const context = this.#handler.getContext();
    const model = context._model ?? options?.context?._model ?? "";
    const data = {
      ...options?.data,
      context: {
        ...context,
        ...options?.context,
      },
    };

    const result = await executeAction({
      action,
      model,
      data,
    });

    for (const item of result) {
      if (item) {
        await this.#handle(item, options);
      }
    }

    return result;
  }

  async #handle(data: ActionResult, options?: ActionOptions) {
    if (data.exportFile) {
      const link = "ws/files/data-export/" + data.exportFile;
      await download(link, data.exportFile);
    }

    if (data.signal === "refresh-app") {
      if (data.info) {
        await dialogs.box({
          title: data.info.title,
          content: data.info.message,
          yesNo: false,
          yesTitle: data.info.confirmBtnTitle,
        });
      }
      window.location.reload();
    }

    if (data.signal === "refresh-tab") {
      const tabId = getActiveTabId();
      const event = new CustomEvent("tab:refresh", { detail: { id: tabId } });
      document.dispatchEvent(event);
    }

    if (data.info) {
      const waitForDialog = dialogs.box({
        title: data.info.title,
        content: data.info.message,
        yesNo: false,
        yesTitle: data.info.confirmBtnTitle,
      });
      if (data.reload || data.pending) {
        await waitForDialog;
        if (data.reload) {
          await this.#handler.refresh();
        }
        if (data.pending) {
          return this.#execute(data.pending, options);
        }
      }
    }

    if (data.notify) {
      if (Array.isArray(data.notify)) {
        data.notify.forEach((x) => alerts.info(x));
      } else {
        alerts.info(data.notify);
      }
      if (data.pending) {
        return this.#execute(data.pending, options);
      }
    }

    if (data.error) {
      await dialogs.box({
        title: data.error.title ?? i18n.get("Error"),
        content: data.error.message,
        yesTitle: data.error.confirmBtnTitle,
        yesNo: false,
      });
      if (data.error.action) {
        await this.#execute(data.error.action, options);
      }
      return Promise.reject();
    }

    if (data.alert) {
      const confirmed = await dialogs.box({
        title: data.alert.title ?? i18n.get("Warning"),
        content: data.alert.message,
        yesTitle: data.alert.confirmBtnTitle,
        noTitle: data.alert.cancelBtnTitle,
      });
      if (confirmed) {
        if (data.pending) {
          return await this.#execute(data.pending, options);
        }
        return;
      }
      if (data.alert.action) {
        await this.#execute(data.alert.action, options);
      }
      return Promise.reject();
    }

    if (data.errors) {
      let hasErrors = false;
      for (const [name, value] of Object.entries(data.errors)) {
        if (value.trim().length > 0) {
          hasErrors = true;
        }
        this.#handler.setAttrs([
          {
            target: name,
            name: "error",
            value,
          },
        ]);
      }
      if (hasErrors) {
        return Promise.reject();
      }
    }

    if (data.values) {
      this.#handler.setValues(data.values);
    }

    if (data.reload) {
      await this.#handler.refresh();
      if (data.pending) {
        await this.#execute(data.pending, options);
      }
      if (data.view) {
        this.#openView(data.view);
      }
      return;
    }

    if (data.validate) {
      await this.#handler.validate();
      if (data.pending) {
        await this.#execute(data.pending, options);
      }
      return;
    }

    if (data.save) {
      await this.#handler.save();
      if (data.pending) {
        await this.#execute(data.pending, options);
      }
      return;
    }

    if (data.new) {
      await this.#handler.edit(null);
      if (data.pending) {
        await this.#execute(data.pending, options);
      }
      return;
    }

    if (data.signal) {
      await this.#handler.onSignal(data.signal, data.signalData);
    }

    if (data.attrs) {
      await this.#handleAttrs(data.attrs);
    }

    if (data.report) {
      if (data.attached) {
        const context = this.#handler.getContext();
        const attachments =
          context["$attachments"] ?? context["attachments"] ?? 0;
        this.#handler.setValue("$attachments", attachments + 1);
        const confirmed = await dialogs.confirm({
          title: i18n.get("Download"),
          content: i18n.get(
            "Report attached to current object. Would you like to download?",
          ),
        });

        if (confirmed) {
          const url = `ws/rest/com.axelor.meta.db.MetaFile/${data.attached.id}/content/download`;
          return download(url, data.attached.fileName);
        }
        return;
      }

      if (data.reportLink) {
        const url = `ws/files/report/${data.reportLink}?name=${data.reportFile}`;
        if (data.reportFormat) {
          await this.#openView({
            title: data.reportFile!,
            resource: url,
            viewType: "html",
          });
        } else {
          download(url);
        }
      }
    }

    if (data.view) {
      this.#openView(data.view);
    }

    if (data.close || data.canClose) {
      this.#closeView();
      this.#handler.close();
    }
  }

  async #closeView() {
    const tabId = getActiveTabId();
    if (tabId) {
      const popups = getActivePopups();
      // should skip close tab for popup view
      // as close of view is managed by popup itself
      if (popups.length) return;
      closeTab(tabId);
    }
  }

  async #openView(view: {
    title?: string;
    model?: string;
    resource?: string;
    viewType?: string;
  }) {
    const name = uniqueId("$act");
    const title = view.title ?? name;
    const model = view.model ?? view.resource;
    const viewType = view.viewType ?? "grid";

    const tab: ActionView = {
      name,
      title,
      model,
      viewType,
      ...view,
    };

    if (this.#handler.refresh && tab.params?.popup) {
      tab.params = {
        ...tab.params,
        __onPopupReload: () => this.#handler.refresh(),
      };
    }

    if (!tab.views) {
      tab.views = [{ type: viewType } as View];
      if (tab.viewType === "html") {
        Object.assign(tab, { model: undefined });
        Object.assign(tab.views[0], {
          resource: tab.resource,
          title: tab.title,
        });
      }
    }

    if (tab.viewType === "html") {
      const view = tab.views.find((x) => x.type === "html") as HtmlView;
      const url = view?.name || view?.resource;

      if (view && url && tab.params?.download) {
        const fileName = tab.params?.fileName;
        return download(url, fileName);
      }

      if (view && url && tab.params?.target === "_blank") {
        window.open(url);
        return;
      }
    }

    return openTab(tab);
  }

  async #handleAttrs(data: Record<string, Record<string, any>>) {
    const list: ActionAttrsData["attrs"] = [];
    for (const [target, attrs] of Object.entries(data)) {
      for (const [name, value] of Object.entries(attrs)) {
        switch (name) {
          case "value:set":
            await this.#handler.setValue(target, value);
            break;
          case "value:add":
            await this.#handler.addValue(target, value);
            break;
          case "value:del":
            await this.#handler.delValue(target, value);
            break;
          default:
            if (name === "refresh" && !target) {
              await this.#handler.refresh();
            } else {
              list.push({ target, name, value });
            }
            break;
        }
      }
    }
    list.length > 0 && (await this.#handler.setAttrs(list));
  }
}

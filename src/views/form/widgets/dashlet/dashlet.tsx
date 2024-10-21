import { useAtomValue } from "jotai";
import { ScopeProvider } from "jotai-molecules";
import { selectAtom, useAtomCallback } from "jotai/utils";
import uniqueId from "lodash/uniqueId";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Box, clsx } from "@axelor/ui";

import { useAsync } from "@/hooks/use-async";
import { useAsyncEffect } from "@/hooks/use-async-effect";
import { Tab, TabProps, initTab } from "@/hooks/use-tabs";
import { DataContext } from "@/services/client/data.types";
import { findActionView } from "@/services/client/meta-cache";
import { CardsView, Schema } from "@/services/client/meta.types";
import { AdvanceSearch } from "@/view-containers/advance-search";
import { DashletView } from "@/view-containers/view-dashlet";
import { useDashletHandlerAtom } from "@/view-containers/view-dashlet/handler";
import { PopupScope } from "@/view-containers/view-popup/handler";
import { Views } from "@/view-containers/views";
import { useViewAction, useViewTab } from "@/view-containers/views/scope";

import {
  Attrs,
  WidgetProps,
  usePermission,
  usePrepareContext,
} from "../../builder";
import { useAfterActions, useFormTabScope } from "../../builder/scope";
import { DashletActions } from "./dashlet-actions";

import classes from "./dashlet.module.scss";

interface DashletProps {
  schema: Schema;
  className?: string;
  popup?: boolean;
  readonly?: boolean;
  dashboard?: boolean;
  attrs?: Attrs;
  viewContext?: DataContext;
  getContext?: () => DataContext;
  viewId?: number;
  onViewLoad?: (schema: Schema, viewId?: number, viewType?: string) => void;
}

function DashletTitle({ title }: { title?: string }) {
  const dashlet = useAtomValue(useDashletHandlerAtom());
  return <Box className={classes.title}>{dashlet.title || title}</Box>;
}

export function DashletComponent({
  schema,
  attrs,
  className,
  readonly,
  popup,
  viewId,
  viewContext,
  dashboard,
  onViewLoad,
  getContext,
}: DashletProps): any {
  const { title, action, canSearch, widgetAttrs } = schema;
  const height = schema.height ?? widgetAttrs?.height;

  const load = useAfterActions(
    useCallback(async () => {
      const context = getContext?.();
      const actionView = await findActionView(action, context, {
        silent: true,
      });
      const ctx = {
        ...actionView.context,
        ...context,
      };
      const { _id, _showRecord } = actionView.context || {};
      return await initTab({
        ...actionView,
        name: uniqueId("$dashlet"),
        params: {
          ...actionView.params,
          dashlet: true,
          "show-toolbar": false,
          "dashlet.canSearch": canSearch,
          ...(popup && {
            "dashlet.in.popup": popup,
          }),
        },
        context: {
          ...(dashboard
            ? ctx
            : {
                ...viewContext,
                ...actionView.context,
                _id: _id || viewContext?._id,
                _showRecord,
              }),
          _model: ctx.model ?? ctx._model,
          _domainAction: action,
        },
      });
    }, [dashboard, action, popup, canSearch, viewContext, getContext]),
  );

  const { data: tab, state } = useAsync(load, [load]);

  const setTabViewProps = useAtomCallback(
    useCallback(
      (
        get,
        set,
        tab: Tab,
        viewType: string,
        param: keyof TabProps,
        value: any,
      ) => {
        const { props, ...tabState } = get(tab.state);
        const viewProps = props?.[viewType];
        if (viewProps?.[param] !== value) {
          set(tab.state, {
            ...tabState,
            props: {
              ...props,
              [viewType]: {
                ...viewProps,
                [param]: value,
              },
            },
          });
        }
      },
      [],
    ),
  );

  useEffect(() => {
    // for grid view to update readonly to show edit icon
    if (tab && tab?.action?.viewType === "grid") {
      setTabViewProps(
        tab,
        "grid",
        "readonly",
        Boolean(readonly || schema.readonly),
      );
    }
  }, [tab, schema.readonly, readonly, setTabViewProps]);

  useEffect(() => {
    // for html view to update url
    if (tab && tab?.action?.viewType === "html") {
      setTabViewProps(tab, "html", "name", attrs?.url);
    }
  }, [tab, attrs?.url, setTabViewProps]);

  if (state === "loading") return null;

  const { viewType = "" } = tab?.action ?? {};
  const hasSearch = canSearch && ["cards"].includes(viewType);

  return (
    tab && (
      <DashletView>
        <Box
          d="flex"
          flexDirection="column"
          className={clsx(classes.container, className)}
          border
          roundedTop
          style={{ height }}
        >
          <Box
            className={clsx(classes.header, {
              [classes.search]: hasSearch,
            })}
          >
            <DashletTitle title={attrs?.title ?? (title || tab?.title)} />
            {hasSearch && <DashletSearch />}
            {attrs?.refresh && <DashletRefresh count={attrs.refresh} />}
            <DashletActions
              dashboard={dashboard}
              viewType={viewType}
              showBars={widgetAttrs?.showBars}
            />
            {viewType && onViewLoad && (
              <DashletViewLoad
                schema={schema}
                viewId={viewId}
                viewType={viewType}
                onViewLoad={onViewLoad}
              />
            )}
          </Box>
          <Box className={classes.content}>
            <ScopeProvider scope={PopupScope} value={{}}>
              {tab && <Views tab={tab} />}
            </ScopeProvider>
          </Box>
        </Box>
      </DashletView>
    )
  );
}

function DashletRefresh({ count }: { count: number }) {
  const { onRefresh } = useAtomValue(useDashletHandlerAtom());
  const doRefresh = useAfterActions(
    useCallback(async () => onRefresh?.(), [onRefresh]),
  );

  useAsyncEffect(async () => {
    if (count) {
      doRefresh();
    }
  }, [count, doRefresh]);

  return null;
}

function DashletSearch() {
  const { view, dataStore, onRefresh, searchAtom } = useAtomValue(
    useDashletHandlerAtom(),
  );
  if (!view) return null;
  const { items, customSearch, freeSearch } = view as CardsView;
  return (
    searchAtom &&
    dataStore &&
    onRefresh && (
      <Box d="flex">
        <AdvanceSearch
          stateAtom={searchAtom}
          dataStore={dataStore!}
          items={items}
          customSearch={customSearch}
          freeSearch={freeSearch}
          onSearch={onRefresh}
        />
      </Box>
    )
  );
}

function DashletViewLoad({
  schema,
  viewId,
  viewType,
  onViewLoad,
}: Pick<DashletProps, "schema" | "viewId" | "onViewLoad"> & {
  viewType: string;
}) {
  const { view } = useAtomValue(useDashletHandlerAtom());
  const $viewType = view?.type || viewType;

  useEffect(() => {
    if ($viewType && onViewLoad) {
      onViewLoad(schema, viewId, $viewType);
    }
  }, [schema, viewId, onViewLoad, $viewType]);

  return null;
}

export function Dashlet(props: WidgetProps) {
  const { active } = useFormTabScope();
  const [show, setShow] = useState(active);

  useEffect(() => {
    setShow((prev) => prev || active);
  }, [active]);

  return show ? <DashletWrapper {...props} /> : null;
}

function DashletWrapper(props: WidgetProps) {
  const { schema, readonly, widgetAtom, formAtom } = props;
  const tab = useViewTab();
  const { attrs } = useAtomValue(widgetAtom);
  const { hasButton } = usePermission(schema, widgetAtom);

  const ready = useAtomValue(
    useMemo(() => selectAtom(formAtom, (form) => form.ready), [formAtom]),
  );

  const viewContext = useViewAction()?.context;
  const getFormContext = usePrepareContext(formAtom);

  const getContext = useCallback(() => {
    return {
      _model: tab.action.model,
      ...getFormContext(),
    } as DataContext;
  }, [tab.action.model, getFormContext]);

  const canEdit = hasButton("edit") && schema.canEdit;

  return (
    ready && (
      <DashletComponent
        schema={schema}
        attrs={attrs}
        popup={tab.popup}
        readonly={canEdit ? false : readonly}
        viewContext={viewContext}
        getContext={getContext}
      />
    )
  );
}

import { useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";

import { Box } from "@axelor/ui";

import { useExpression } from "@/hooks/use-parser";
import { HtmlView } from "@/services/client/meta.types";
import { useDashletHandlerAtom } from "@/view-containers/view-dashlet/handler";
import {
  useViewContext,
  useViewProps,
  useViewTab,
  useViewTabRefresh,
} from "@/view-containers/views/scope";

import { useAfterActions } from "../form/builder/scope";
import { ViewProps } from "../types";

import styles from "./html.module.scss";

export function Html(props: ViewProps<HtmlView>) {
  const {
    meta: { view },
  } = props;
  const [viewProps] = useViewProps();
  const { dashlet } = useViewTab();
  const getContext = useViewContext();
  const setDashletHandlers = useSetAtom(useDashletHandlerAtom());

  const [url, setUrl] = useState<string>();
  const [updateCount, setUpdateCount] = useState(0);

  const name = viewProps?.name || view.name || view.resource;
  const parseURL = useExpression(name!);

  const getURL = useCallback(() => {
    let url = `${name}`;
    if (url && url.includes("{{")) {
      url = parseURL(getContext());
    }
    return url ?? "";
  }, [getContext, name, parseURL]);

  const onRefresh = useCallback(async () => {
    setUpdateCount((prev) => prev + 1);
    setUrl(() => getURL());
  }, [getURL]);

  const doLoad = useAfterActions(onRefresh);

  useEffect(() => {
    doLoad();
  }, [doLoad]);

  useEffect(() => {
    if (dashlet) {
      setDashletHandlers({
        view,
        onRefresh: onRefresh as any,
      });
    }
  }, [dashlet, view, onRefresh, setDashletHandlers]);

  // register tab:refresh
  useViewTabRefresh("html", onRefresh);

  const key = `${url}_${updateCount}`;

  return (
    <Box flexGrow={1} position="relative" className={styles.container}>
      <Box d="flex" position="absolute" className={styles.frame}>
        {url && (
          <Box
            key={key}
            as="iframe"
            title="HTML View"
            src={url}
            w={100}
            h={100}
            flex={1}
          />
        )}
      </Box>
    </Box>
  );
}

import clsx from "clsx";
import { Provider, atom, createStore, useAtomValue } from "jotai";
import { uniqueId } from "lodash";
import { createRef, useEffect } from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";

import { Alert, AlertHeader, Fade, Portal, useTheme } from "@axelor/ui";

import { i18n } from "@/services/client/i18n";
import { SanitizedContent } from "@/utils/sanitize";

import styles from "./alerts.module.css";

export type AlertType =
  | "primary"
  | "secondary"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type AlertProps = {
  id: string;
  type: AlertType;
  title?: string;
  message: React.ReactNode;
};

const alertsAtom = atom<AlertProps[]>([]);
const alertsStore = createStore();

const closeAlert = (id: string) => {
  const alerts = alertsStore.get(alertsAtom);
  const found = alerts.find((x) => x.id === id);
  if (found) {
    alertsStore.set(alertsAtom, (prev) => prev.filter((x) => x !== found));
  }
};

const showAlert = (alert: {
  type: AlertType;
  title?: string;
  message: React.ReactNode;
}) => {
  const id = uniqueId("n");
  const nodeRef = createRef();
  alertsStore.set(alertsAtom, (prev) => [{ id, nodeRef, ...alert }, ...prev]);
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export module alerts {
  export function info(options: { title?: string; message: React.ReactNode }) {
    showAlert({
      type: "info",
      title: i18n.get("Information"),
      ...options,
    });
  }
  export function warn(options: { title?: string; message: React.ReactNode }) {
    showAlert({
      type: "warning",
      title: i18n.get("Warning"),
      ...options,
    });
  }
  export function error(options: { title?: string; message: React.ReactNode }) {
    showAlert({ type: "danger", title: i18n.get("Error"), ...options });
  }
  export function success(options: {
    title?: string;
    message: React.ReactNode;
  }) {
    showAlert({ type: "success", ...options });
  }
}

export function AlertsProvider() {
  return (
    <Provider store={alertsStore}>
      <Alerts />
    </Provider>
  );
}

function Alerts() {
  const alerts = useAtomValue(alertsAtom);
  const { dir } = useTheme();
  return (
    <Portal>
      <Fade in={alerts.length > 0} timeout={500} mountOnEnter unmountOnExit>
        <div className={clsx(styles.alerts, { [styles.rtl]: dir === "rtl" })}>
          <TransitionGroup component={null}>
            {alerts.map((item: AlertProps & { nodeRef?: any }) => (
              <CSSTransition
                key={item.id}
                timeout={500}
                nodeRef={item.nodeRef}
                classNames={{
                  enter: styles["item-enter"],
                  enterActive: styles["item-enter-active"],
                  exit: styles["item-exit"],
                  exitActive: styles["item-exit-active"],
                }}
              >
                <div ref={item.nodeRef}>
                  <AlertContainer {...item} />
                </div>
              </CSSTransition>
            ))}
          </TransitionGroup>
        </div>
      </Fade>
    </Portal>
  );
}

function AlertContainer({ id, type = "info", title, message }: AlertProps) {
  useEffect(() => {
    const timer = setTimeout(() => closeAlert(id), 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [id]);
  if (typeof message === "string") {
    message = <SanitizedContent content={message} />;
  }
  return (
    <Alert variant={type} shadow className={styles.alert}>
      <AlertHeader>{title}</AlertHeader>
      {message}
    </Alert>
  );
}

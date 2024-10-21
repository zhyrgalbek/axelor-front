import React, { LegacyRef } from "react";
import { Icon } from "@/components/icon";
import { legacyClassNames } from "@/styles/legacy";
import { i18n } from "@/services/client/i18n";

export const ReportBox = React.forwardRef(function ReportBox(
  {
    icon,
    label,
    tag: _tag,
    up: _up,
    "tag-css": _tagCss,
    percent: _percent,
    value: _value,
    eval: $eval,
    context,
  }: {
    icon: string;
    label: string;
    tag?: string;
    "tag-css"?: string;
    percent?: number | string;
    up?: string;
    value: number | string;
    eval: (arg: any) => any;
    context: Record<string, any>;
  },
  boxRef,
) {
  const ref = React.useRef<HTMLDivElement>();
  const value = $eval(_value);
  const percent = $eval(_percent);
  const tag = $eval(_tag);
  const tagCss = $eval(_tagCss);
  const up = $eval(_up);

  function format(value: any) {
    return isNaN(value) ? value : context.__number(value);
  }

  function percentStyle() {
    let type;
    if (up == null) {
      type = "info";
    } else {
      type = up ? "success" : "error";
    }
    return "text-" + type;
  }

  React.useEffect(() => {
    const el = ref.current;
    if (el) {
      const dashlet = el?.parentElement?.parentElement;
      if (dashlet) {
        const className = legacyClassNames("report-box");
        dashlet.classList.add(className);
        return () => dashlet.classList.remove(className);
      }
    }
  }, []);

  return (
    <div
      ref={ref as LegacyRef<HTMLDivElement>}
      className={legacyClassNames("report-data", "hidden")}
    >
      {icon && icon.includes("fa-") && (
        <i className={legacyClassNames("report-icon", "fa", icon)} />
      )}
      {icon && !icon.includes("fa-") && (
        <Icon icon={icon} className={legacyClassNames("report-icon")} />
      )}
      <div>
        <h1>{format(value)}</h1>
        <small>{i18n.get(label)}</small>
        <div
          className={legacyClassNames(
            "report-percent",
            "font-bold",
            "pull-right",
            percentStyle(),
          )}
        >
          <span>{context.__percent(percent)}</span>
          {up != null && <Icon icon={"trending_" + (up ? "up" : "down")}/>}
        </div>
      </div>
      {tag && (
        <div className={legacyClassNames("report-tags")}>
          <span className={legacyClassNames("label", tagCss)}>{tag}</span>
        </div>
      )}
    </div>
  );
});

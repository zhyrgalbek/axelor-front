import { TreeNode as TreeRecord } from "@axelor/ui";
import { ReactElement, cloneElement, useCallback } from "react";

import { TreeView } from "@/services/client/meta.types";
import { ActionExecutor } from "@/view-containers/action";
import { getNodeOfTreeRecord } from "../../utils";

export interface NodeProps {
  data: TreeRecord;
  view: TreeView;
  children: ReactElement;
  actionExecutor: ActionExecutor;
}

export function Node({ data, view, actionExecutor, children }: NodeProps) {
  const node = getNodeOfTreeRecord(view, data);
  const onDoubleClick = useCallback<React.MouseEventHandler>(
    (e) => {
      if (node && node.onClick) {
        actionExecutor.execute(node.onClick, {
          context: {
            ...data.data,
            _model: node?.model,
          },
        });
      }
    },
    [actionExecutor, data.data, node]
  );
  return node?.onClick ? cloneElement(children, { onDoubleClick }) : children;
}

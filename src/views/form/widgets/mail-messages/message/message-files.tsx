import { ReactElement } from "react";
import { Box } from "@axelor/ui";
import { MaterialIcon } from "@axelor/ui/icons/material-icon";

import { MessageFile } from "./types";
import { download as downloadFile } from "@/utils/download";
import styles from "./message-files.module.scss";
import { Icon } from "@/components/icon";

function download(file: MessageFile) {
  downloadFile(
    `ws/rest/com.axelor.meta.db.MetaFile/${
      file["metaFile.id"] || file["id"]
    }/content/download`,
    file.fileName,
  );
}

export function MessageFiles({
  stack,
  data = [],
  showIcon = true,
  onRemove,
}: {
  data?: MessageFile[];
  showIcon?: boolean;
  stack?: boolean;
  onRemove?: (file: MessageFile, index: number) => void;
}) {
  return (data.length > 0 && (
    <Box as="ul" m={1} ms={0} me={0} p={0} className={styles.list}>
      {data.map(($file, ind) => (
        <Box
          as="li"
          d={stack ? "flex" : "inline-flex"}
          p={0}
          ps={1}
          pe={1}
          key={$file.id}
          {...(!stack && {
            alignItems: "center",
          })}
        >
          {onRemove && (
            <Box d="inline-flex" alignItems="center" as="span" me={1}>
              <MaterialIcon
                className={styles.close}
                fill
                icon="close"
                onClick={() => onRemove($file, ind)}
              />
            </Box>
          )}
          {showIcon && (
            <Icon
              icon={$file.typeIcon || $file.fileIcon || "paperclip"}
              className={styles.icon}
            />
          )}
          <Box
            as="a"
            className={styles.link}
            onClick={(e:any) => {
              e.preventDefault();
              download($file);
            }}
          >
            {$file.fileName}
          </Box>
        </Box>
      ))}
    </Box>
  )) as ReactElement;
}

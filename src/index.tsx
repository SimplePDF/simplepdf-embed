import * as React from "react";
import { createPortal } from "react-dom";

import "./styles.scss";

interface Props {
  children: React.ReactElement;
}

export const PDFEditor: React.FC<Props> = ({ children }) => {
  const [shouldDisplayModal, setShouldDisplayModal] = React.useState(false);
  const handleAnchorClick = React.useCallback((e: Event) => {
    e.preventDefault();
    setShouldDisplayModal(true);
  }, []);

  return (
    <>
      {shouldDisplayModal &&
        createPortal(
          <div className="container">
            <iframe
              className="content"
              src={`https://embed.simplepdf.eu/editor?open=${children.props.href}`}
            />
          </div>,
          document.body
        )}

      {React.cloneElement(children, { onClick: handleAnchorClick })}
    </>
  );
};

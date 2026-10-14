import React from "react";
import { Pagina } from "../casca/casca";
import { Cabecalho, Vazio } from "../ui/kit";

/** tela ainda em migração */
export function Provisoria({ titulo }: { titulo: string }) {
  return (
    <Pagina>
      <Cabecalho titulo={titulo} />
      <Vazio icone="ajustes" titulo="Em migração" texto="Esta tela ainda está sendo portada para o app." />
    </Pagina>
  );
}

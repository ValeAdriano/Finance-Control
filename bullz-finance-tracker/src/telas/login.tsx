/* Login — port de telas/login.js.
 *
 * A senha nunca é guardada pelo app: vai por HTTPS para o Supabase Auth, que
 * armazena só o hash bcrypt. Com a verificação em duas etapas ligada, a sessão
 * só é liberada depois do código do autenticador. */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, View, type TextInput } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { useTema } from "../tema";
import { useApp } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Botao, Mensagem, T } from "../ui/kit";
import { Entrada, Form, Seletor } from "../ui/campos";
import { ui } from "../ui/folha";
import { Icone } from "../ui/icone";
import FC from "../nucleo";

type Modo = "entrar" | "criar" | "mfa";

function forca(s: string) {
  let n = 0;
  if (s.length >= 10) n++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) n++;
  if (/\d/.test(s)) n++;
  if (s.length >= 14 || /[^A-Za-z0-9]/.test(s)) n++;
  return n;
}
const senhaValida = (s: string) => s.length >= 10 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s);

const TITULOS: Record<Modo, [string, string]> = {
  entrar: ["Bullz", "Entre para ver sua carteira."],
  criar: ["Criar conta", "Seus investimentos em um lugar só. Só você vê o que cadastrar."],
  mfa: ["Verificação", "Digite o código de 6 dígitos do seu app autenticador."],
};

export default function Login() {
  const t = useTema();
  const { estreito, largura, altura } = useMedidas();
  const fase = useApp((s) => s.fase);
  const avisoGlobal = useApp((s) => s.avisoLogin);
  const [modo, setModo] = useState<Modo>(fase === "mfa" ? "mfa" : "entrar");
  const [aviso, setAviso] = useState<string | null>(avisoGlobal);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fatores, setFatores] = useState<any[]>([]);
  const [fator, setFator] = useState("");
  const [enviando, setEnviando] = useState(false);
  const treme = useRef(new Animated.Value(0)).current;
  const entra = useRef(new Animated.Value(0)).current;
  const flutua = useRef(new Animated.Value(0)).current;
  const primeiro = useRef<TextInput>(null);

  useEffect(() => { setModo(fase === "mfa" ? "mfa" : "entrar"); }, [fase]);
  useEffect(() => { setAviso(avisoGlobal); }, [avisoGlobal]);
  useEffect(() => {
    if (modo !== "mfa") return;
    FC.auth.fatores().then((f: any) => {
      const v = (f.totp || []).filter((x: any) => x.status === "verified");
      setFatores(v); setFator(v[0]?.id || "");
    }).catch(() => {});
  }, [modo]);
  useEffect(() => {
    entra.setValue(0);
    Animated.timing(entra, { toValue: 1, duration: 700, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: Platform.OS !== "web" }).start();
    const id = setTimeout(() => primeiro.current?.focus(), 300);
    return () => clearTimeout(id);
  }, [modo, entra]);
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flutua, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(flutua, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [flutua]);

  const mostraErro = (m: string) => {
    setErro(m);
    treme.setValue(0);
    Animated.sequence([
      Animated.timing(treme, { toValue: -8, duration: 75, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(treme, { toValue: 8, duration: 150, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(treme, { toValue: 0, duration: 75, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  };

  const troca = (m: Modo, av: string | null = null) => {
    setModo(m); setErro(null); setAviso(av); setSenha(""); setSenha2(""); setCodigo("");
    if (m !== "mfa") useApp.setState({ fase: "login" });
  };

  const envia = async (cod?: string) => {
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      if (modo === "mfa") {
        const escolhido = fator || (fatores[0] || {}).id;
        if (!escolhido) throw new Error("Nenhum autenticador cadastrado.");
        await FC.auth.verificarTotp(escolhido, cod ?? codigo);
        useApp.setState({ avisoLogin: null });
        await FC.entrarNoApp();
        return;
      }
      if (!email || !senha) throw new Error("Preencha e-mail e senha.");
      if (modo === "criar") {
        if (!senhaValida(senha)) throw new Error("A senha precisa de ao menos 10 caracteres, com maiúscula, minúscula e número.");
        if (senha !== senha2) throw new Error("As senhas não coincidem.");
        const vazou = await FC.auth.senhaVazada(senha);
        if (vazou) throw new Error(`Essa senha já apareceu em ${FC.fmt.int(vazou)} vazamento(s) de dados. Escolha outra.`);
        const r = await FC.auth.cadastrar(email.trim(), senha, nome.trim());
        // com confirmação de e-mail ligada no Supabase, a sessão só vem depois do link
        if (!r.session) { troca("entrar", "Conta criada. Abra o link que enviamos para " + email.trim() + " e depois entre."); return; }
        ui.aviso("Conta criada. Bem-vindo!");
        useApp.setState({ avisoLogin: null });
        await FC.entrarNoApp();
        return;
      }
      await FC.auth.entrar(email.trim(), senha);
      const n = await FC.auth.nivel();
      if (n.nextLevel === "aal2" && n.currentLevel !== "aal2") { troca("mfa"); useApp.setState({ fase: "mfa" }); return; }
      useApp.setState({ avisoLogin: null });
      await FC.entrarNoApp();
    } catch (e: any) {
      mostraErro(FC.ui.traduzErro(e.message || String(e)));
      if (modo === "mfa") setCodigo("");
    } finally {
      setEnviando(false);
    }
  };

  const [titulo, sub] = TITULOS[modo];
  const nForca = forca(senha);
  const corForca = [t.cores.campo, t.cores.vermelho, t.cores.s3, t.cores.s2, t.cores.verde][nForca];
  return (
    <View style={{ flex: 1, backgroundColor: t.cores.bg }}>
      <Svg width={largura} height={altura} style={{ position: "absolute" }}>
        <Defs>
          <RadialGradient id="g1" cx={largura * 0.1} cy={-altura * 0.1} rx={1200} ry={600} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="rgb(10,132,255)" stopOpacity={0.16} />
            <Stop offset="0.6" stopColor="rgb(10,132,255)" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="g2" cx={largura * 1.1} cy={altura * 1.1} rx={900} ry={500} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="rgb(94,92,230)" stopOpacity={0.14} />
            <Stop offset="0.6" stopColor="rgb(94,92,230)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={largura} height={altura} fill="url(#g1)" />
        <Rect width={largura} height={altura} fill="url(#g2)" />
      </Svg>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: t.espaco.e4 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={{
            width: "100%", maxWidth: 400, backgroundColor: t.cores.vidro, borderWidth: 1, borderColor: t.cores.linha, borderRadius: 28,
            boxShadow: t.cores.sombraAlta, paddingTop: estreito ? 36 : 48, paddingHorizontal: estreito ? 24 : 40, paddingBottom: estreito ? 28 : 40,
            opacity: entra, transform: [{ translateY: entra.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: entra.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
            ...(Platform.OS === "web" ? { backdropFilter: "saturate(180%) blur(30px)" } : {}),
          } as any}>
            <Animated.View style={{ width: 72, height: 72, borderRadius: 20, alignSelf: "center", marginBottom: t.espaco.e4, overflow: "hidden",
              transform: [{ translateY: flutua.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>
              <Image source={require("../../assets/img/icone-512.png")} style={{ width: 72, height: 72 }} resizeMode="contain" accessibilityLabel="Bullz" />
            </Animated.View>
            <T style={{ fontSize: 28, fontWeight: "600", letterSpacing: -0.6, textAlign: "center" }} accessibilityRole="header">{titulo}</T>
            <T centro style={{ color: t.cores.ink2, marginTop: 6, marginBottom: t.espaco.e4, fontSize: 15 }}>{sub}</T>

            <Animated.View style={{ transform: [{ translateX: treme }] }}>
              <Form gap={12}>
                {modo === "mfa" ? (
                  <>
                    {fatores.length > 1 ? (
                      <Seletor valor={fator} aoMudar={setFator} rotuloA11y="Autenticador"
                        opcoes={fatores.map((f) => ({ v: f.id, rotulo: (f.friendly_name || "Autenticador").replace(/ \d{10,}$/, "").replace(/ [a-z0-9]{4}$/, "") }))} />
                    ) : null}
                    <Entrada ref={primeiro} valor={codigo} placeholder="000000" maxLength={6} keyboardType="number-pad"
                      textContentType="oneTimeCode" autoComplete="one-time-code" accessibilityLabel="Código"
                      aoMudar={(v) => { const d = v.replace(/\D/g, ""); setCodigo(d); if (d.length === 6) envia(d); }}
                      style={{ letterSpacing: 12, textAlign: "center", fontSize: 24, fontWeight: "600" }} />
                  </>
                ) : (
                  <>
                    {modo === "criar" ? (
                      <Entrada valor={nome} aoMudar={setNome} placeholder="Como quer ser chamado" maxLength={40}
                        autoComplete="given-name" autoCapitalize="words" accessibilityLabel="Nome" />
                    ) : null}
                    <Entrada ref={modo === "entrar" ? primeiro : undefined} valor={email} aoMudar={setEmail} placeholder="E-mail"
                      keyboardType="email-address" autoComplete="email" textContentType="username" accessibilityLabel="E-mail" />
                    <View style={{ gap: 6 }}>
                      <Entrada valor={senha} aoMudar={setSenha} placeholder="Senha" secureTextEntry accessibilityLabel="Senha"
                        autoComplete={modo === "criar" ? "new-password" : "current-password"} textContentType={modo === "criar" ? "newPassword" : "password"}
                        onSubmitEditing={() => modo === "entrar" && envia()} returnKeyType={modo === "entrar" ? "go" : "next"} />
                      {modo === "criar" ? (
                        <>
                          <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
                            {[1, 2, 3, 4].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= nForca ? corForca : t.cores.campo }} />)}
                          </View>
                          <T v="dica">Mínimo de 10 caracteres, com maiúscula, minúscula e número.</T>
                        </>
                      ) : null}
                    </View>
                    {modo === "criar" ? (
                      <Entrada valor={senha2} aoMudar={setSenha2} placeholder="Repita a senha" secureTextEntry accessibilityLabel="Repita a senha"
                        autoComplete="new-password" textContentType="newPassword" onSubmitEditing={() => envia()} returnKeyType="go" />
                    ) : null}
                  </>
                )}
                {aviso ? <Mensagem tipo="info" icone="cadeado">{aviso}</Mensagem> : null}
                {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
                <Botao cheio onPress={() => envia()} carregando={enviando}>{modo === "criar" ? "Criar conta" : modo === "mfa" ? "Verificar" : "Entrar"}</Botao>
                {modo === "mfa" ? (
                  <Botao variante="texto" style={{ alignSelf: "center" }} onPress={async () => { await FC.auth.sair(); troca("entrar"); }}>Usar outra conta</Botao>
                ) : null}
                <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                  {modo === "entrar" ? <><T style={{ fontSize: 14, color: t.cores.ink2 }}>Ainda não tem conta? </T><Botao variante="texto" pequeno style={{ minHeight: 0, paddingHorizontal: 2 }} onPress={() => troca("criar")}>Criar conta</Botao></> : null}
                  {modo === "criar" ? <><T style={{ fontSize: 14, color: t.cores.ink2 }}>Já tem conta? </T><Botao variante="texto" pequeno style={{ minHeight: 0, paddingHorizontal: 2 }} onPress={() => troca("entrar")}>Entrar</Botao></> : null}
                </View>
              </Form>
            </Animated.View>

            <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", justifyContent: "center", marginTop: t.espaco.e4 }}>
              <View style={{ marginTop: 1 }}><Icone nome="cadeado" tam={14} cor={t.cores.ink3} /></View>
              <T centro style={{ fontSize: 12.5, lineHeight: 17, color: t.cores.ink3, flexShrink: 1 }}>
                Conexão criptografada · senha protegida com bcrypt · o login fica salvo neste aparelho por até 7 dias sem uso
              </T>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

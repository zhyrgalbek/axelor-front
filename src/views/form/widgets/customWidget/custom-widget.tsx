import { useEffect, useRef, useState } from "react";
import classes from "./custom-widget.module.scss";
import { http } from "@/services/http";

interface OptionType {
    wssServer: string,
    WebSocketPort: string,
    ServerPath: string,
    SipDomain: string,
    SipUsername: string,
    SipPassword: string,
    profileName: string,
    NotificationsActive: boolean,
    RecordAllCalls: boolean,
    FixedNumber: string
}

interface DefaultOptionType extends OptionType {
    loadAlternateLang: boolean,
    welcomeScreen: boolean,
    EnableAccountSettings: boolean,
    VoiceMailSubscribe: boolean,
    chatEngine: string,
    EnableTextMessaging: boolean,
    SingleInstance: boolean
}

declare global {
    interface Window {
        phoneOptions: DefaultOptionType;
    }
}

interface CoordinateType {
    offsetX: number | null,
    offsetY: number | null
}

interface DialogStyleType {
    right: string,
    bottom: string
}

export function CustomWidget() {
    const [dialogContainerClass, setDialogContainerClass] = useState<string>(`${classes.dialogContainer}`);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [coordinate, setCoordinate] = useState<CoordinateType>({
        offsetX: null,
        offsetY: null
    });
    const [dialogStyle, setDialogStyle] = useState<DialogStyleType>({
        right: '20px',
        bottom: '20px'
    });
    const [iframeClasses, setIframeClasses] = useState<string>(`${classes.iframePhone}`);
    const dialogDiv = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [defaultOption, setDefaultOption] = useState<DefaultOptionType>({
        loadAlternateLang: true,
        welcomeScreen: false,
        profileName: "",
        EnableAccountSettings: false,
        wssServer: "callconcept.brisklyminds.com",
        WebSocketPort: "443",
        ServerPath: "/ws",
        SipDomain: "callconcept.brisklyminds.com",
        SipUsername: "",
        SipPassword: "",
        VoiceMailSubscribe: true,
        chatEngine: "SIMPLE",
        RecordAllCalls: true,
        EnableTextMessaging: true,
        SingleInstance: false,
        NotificationsActive: true,
        FixedNumber: ""
    });

    useEffect(() => {
        const fetchData = async () => {
            let data = await initializationAsterisk();
            if (data.asteriskLogin && data.asteriskPassword) {
                let newDefaultOption = {
                    ...defaultOption,
                    profileName: data.fullName,
                    SipUsername: data.asteriskLogin,
                    SipPassword: data.asteriskPassword
                }
                setDefaultOption(newDefaultOption);
            }
        }
        fetchData();
    }, []);

    useEffect(() => {
        if (defaultOption.SipUsername && defaultOption.SipPassword) {
            setTimeout(() => {
                let win = iframeRef.current?.contentWindow;
                if (win) {
                    win.postMessage(JSON.stringify(defaultOption), `https://${defaultOption.SipDomain}`);
                }
            }, 1000)
        }
    }, [defaultOption])

    const initializationAsterisk = async () => {
        try {
            let response = await http.get('ws/user/id');
            let data = await response.json();
            if (!data.data.id) {
                return null;
            }
            let responseUser = await http.post(`ws/rest/com.axelor.auth.db.User/search`, {
                body: JSON.stringify({
                    "offset": 0,
                    "limit": 200,
                    "fields": [
                        "asteriskLogin",
                        "asteriskPassword",
                        "fullName"
                    ],
                    "data": {
                        "criteria": [
                            {
                                "fieldName": "id",
                                "operator": "=",
                                "value": data.data.id
                            }
                        ]
                    }
                }),
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            let userParseJson = await responseUser.json();
            if (userParseJson.data[0]) {
                return userParseJson.data[0];
            } else {
                return null;
            }
        } catch (error) {
            console.error('Request failed: ', error);
        }
    }

    useEffect(() => {
        window.addEventListener("message", (event) => {
            // Проверка отправителя (origin) для безопасности
            if (event.origin !== `https://${defaultOption.SipDomain}`) {
                return;
            }

            // Обработка сообщения
            // if (typeof event.data === "string") {
            //     console.log("Сообщение из iframe:", JSON.parse(event.data));
            // }

            if (dialogContainerClass.includes("minimized")) {
                setDialogContainerClass(`${classes.dialogContainer}`);
                setIframeClasses(`${classes.iframePhone}`);
            }
        });
    }, [dialogContainerClass, iframeClasses])

    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging || !dialogDiv.current) return;
        if (coordinate.offsetX && coordinate.offsetY) {
            // setDialogStyle({
            //     left: `${e.clientX - coordinate.offsetX}px`,
            //     top: `${e.clientY - coordinate.offsetY}px`
            // });
        }
    }

    const onMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    }

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (!dialogDiv.current) return;
        // Запоминаем начальные координаты клика и положения диалога
        const rect = dialogDiv.current.getBoundingClientRect();
        setIsDragging(true);

        console.log(e.clientX - rect.left);
        console.log(e.clientY - rect.top);

        setCoordinate({
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        });

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

    }

    return (
        <div className={classes.customWidget}>
            {
                defaultOption.SipUsername && defaultOption.SipPassword &&
                <div className={dialogContainerClass} style={{ display: 'block', right: dialogStyle.right, bottom: dialogStyle.bottom }} ref={dialogDiv} >
                    <div className={classes.titleBar}>
                        Браузер телефон
                        <div className={classes.titbleBarButtons}>

                            <button style={{ marginLeft: '10px' }} className={classes.button} onClick={() => {
                                if (dialogContainerClass.includes("minimized")) {
                                    setDialogContainerClass(`${classes.dialogContainer}`);
                                    setIframeClasses(`${classes.iframePhone}`);
                                } else {
                                    setDialogContainerClass(`${classes.dialogContainer} ${classes.minimized}`);
                                    setIframeClasses(`${classes.iframePhone} ${classes.iframePhoneNone}`)
                                }
                            }}><RemovIcon /></button>
                            <button style={{ marginLeft: '10px' }} className={classes.button} onClick={() => {
                                if (dialogContainerClass.includes("maximized")) {
                                    setDialogContainerClass(`${classes.dialogContainer}`);
                                    // setDialogStyle({
                                    //     right: '1672px',
                                    //     bottom: '687px'
                                    // })
                                } else {
                                    setDialogContainerClass(`${classes.dialogContainer} ${classes.maximized}`);
                                    setIframeClasses(`${classes.iframePhone}`);
                                }
                            }}><SpaceIcon /></button>
                        </div>

                    </div>
                    <iframe ref={iframeRef} sandbox="allow-same-origin allow-scripts" allow="microphone; camera" src={`https://${defaultOption.SipDomain}/phone/phone/index.html`} frameBorder="0" width="100%" height="100%" className={iframeClasses}>

                    </iframe>
                </div>
            }
        </div>
    )
}

function RemovIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" height="11px" viewBox="0 -960 960 960" width="11px" fill="#6c757d"><path d="M200-440v-80h560v80H200Z" /></svg>;
}

function SpaceIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" height="11px" viewBox="0 -960 960 960" width="11px" fill="#6c757d"><path d="M80-800v-80h800v80H80Zm0 720v-80h800v80H80Zm200-520v-120h400v120H280Zm0 360v-120h400v120H280Z" /></svg>;
}

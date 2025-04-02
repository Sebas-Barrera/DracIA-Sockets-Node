// import React from "react";
// import { View, Text, StyleSheet, FlatList, Platform } from "react-native";
// import { MaterialIcons } from "@expo/vector-icons";
// import { Shield } from "lucide-react-native";

// interface Alert {
//   level: "Alto" | "Medio" | "Bajo" | "Otro";
//   title: string;
//   description: string;
//   time: string;
// }

// interface AlertListProps {
//   alerts: Alert[];
// }

// const AlertList: React.FC<AlertListProps> = ({ alerts }) => {
//   const getAlertStyle = (level: Alert["level"]) => {
//     switch (level) {
//       case "Alto":
//         return styles.highAlert;
//       case "Medio":
//         return styles.mediumAlert;
//       case "Bajo":
//         return styles.lowAlert;
//       default:
//         return styles.defaultAlert;
//     }
//   };

//   const getAlertIcon = (level: Alert["level"]) => {
//     switch (level) {
//       case "Alto":
//         return "error";
//       case "Medio":
//         return "warning";
//       case "Bajo":
//         return "info";
//       default:
//         return "notifications";
//     }
//   };

//   return (
//     <View style={styles.container}>
//       {/* Header con estilos unificados */}
//       <View style={styles.header}>
//         <View style={styles.headerTop}>
//           <View style={styles.titleContainer}>
//             <View style={styles.settingIcon}>
//               <Shield size={20} color="#000000" />
//             </View>
//             <Text style={styles.settingTitle}>Alertas de Seguridad</Text>
//           </View>
//         </View>
//       </View>

//       {/* Lista de alertas */}
//       <FlatList
//         data={alerts}
//         contentContainerStyle={styles.listContent}
//         keyExtractor={(item, index) => index.toString()}
//         renderItem={({ item }) => (
//           <View style={[styles.alertItem, getAlertStyle(item.level)]}>
//             <MaterialIcons
//               name={getAlertIcon(item.level)}
//               size={24}
//               color="white"
//             />
//             <View style={styles.alertTextContainer}>
//               <Text style={styles.alertTitle}>{item.title}</Text>
//               <Text style={styles.alertDescription}>{item.description}</Text>
//               <Text style={styles.alertTime}>{item.time}</Text>
//             </View>
//           </View>
//         )}
//       />
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   // Estilos del contenedor principal
//   container: {
//     flex: 1,
//     backgroundColor: "#f8fafc",
//   },

//   // Estilos del header (copiados del componente de configuración)
//   header: {
//     paddingTop: Platform.OS === "web" ? 24 : 60,
//     paddingHorizontal: 15,
//     paddingBottom: 16,
//     backgroundColor: "#fff",
//     borderBottomWidth: 1,
//     borderBottomColor: "#f1f5f9",
//   },
//   headerTop: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     marginBottom: 16,
//   },
//   titleContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//   },

//   // Estilos unificados (iguales al componente de configuración)
//   settingIcon: {
//     width: 40,
//     height: 40,
//     justifyContent: "center",
//     alignItems: "center",
    
//   },
//   settingTexts: {
//     flex: 1,
//   },
//   settingTitle: {
//     fontSize: 24,
//     color: "#1e293b",
//     fontWeight: "600",
//     fontFamily: "Inter-Bold",
//   },

//   // Estilos específicos de la lista de alertas
//   listContent: {
//     padding: 16,
//     paddingBottom: 80,
//   },
//   alertItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     padding: 16,
//     borderRadius: 16,
//     marginBottom: 12,
//     ...Platform.select({
//       web: {
//         boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//       },
//       default: {
//         elevation: 2,
//         shadowColor: "#000",
//         shadowOffset: { width: 0, height: 1 },
//         shadowOpacity: 0.1,
//         shadowRadius: 3,
//       },
//     }),
//   },
//   alertTextContainer: {
//     marginLeft: 12,
//     flex: 1,
//   },
//   alertTitle: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "white",
//     marginBottom: 2,
//   },
//   alertDescription: {
//     fontSize: 14,
//     color: "rgba(255,255,255,0.9)",
//   },
//   alertTime: {
//     fontSize: 12,
//     color: "rgba(255,255,255,0.7)",
//     marginTop: 4,
//   },

//   // Colores según nivel de alerta
//   highAlert: {
//     backgroundColor: "#ef4444", // Rojo
//   },
//   mediumAlert: {
//     backgroundColor: "#f59e0b", // Ámbar
//   },
//   lowAlert: {
//     backgroundColor: "#10b981", // Verde
//   },
//   defaultAlert: {
//     backgroundColor: "#64748b", // Gris
//   },
// });

// export default AlertList;
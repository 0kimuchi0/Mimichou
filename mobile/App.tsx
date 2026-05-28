import React, { createContext, useContext, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, Text, StyleSheet } from 'react-native'
import { HistoryScreen } from './src/screens/HistoryScreen'
import { RecommendScreen } from './src/screens/RecommendScreen'
import { BGMScreen } from './src/screens/BGMScreen'
import type { ParsedData } from './src/lib/parser'

interface AppContextType {
  parsedData: ParsedData | null
  setParsedData: (data: ParsedData | null) => void
  listeningProfile: string
  setListeningProfile: (profile: string) => void
}

const AppContext = createContext<AppContextType>({
  parsedData: null,
  setParsedData: () => {},
  listeningProfile: '',
  setListeningProfile: () => {},
})

export function useAppContext() {
  return useContext(AppContext)
}

const Tab = createBottomTabNavigator()

const C = {
  bg: '#1a1a2e',
  surface: '#16213e',
  accent: '#c0392b',
  text: '#f5f0e8',
  textDim: 'rgba(245,240,232,0.4)',
  border: 'rgba(192,57,43,0.3)',
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.iconFocused]}>
      <Text style={[styles.iconText, { color: focused ? C.text : C.textDim }]}>{label}</Text>
    </View>
  )
}

export default function App() {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [listeningProfile, setListeningProfile] = useState('')

  return (
    <AppContext.Provider value={{ parsedData, setParsedData, listeningProfile, setListeningProfile }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor={C.bg} />
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: C.surface,
                borderTopColor: C.border,
                borderTopWidth: 1,
                height: 70,
                paddingBottom: 8,
              },
              tabBarActiveTintColor: C.text,
              tabBarInactiveTintColor: C.textDim,
              tabBarLabelStyle: {
                fontSize: 10,
                letterSpacing: 0.5,
              },
            }}
          >
            <Tab.Screen
              name="音歴"
              component={HistoryScreen}
              options={{
                tabBarLabel: '音歴',
                tabBarIcon: ({ focused }) => <TabIcon label="歴" focused={focused} />,
              }}
            />
            <Tab.Screen
              name="推薦"
              component={RecommendScreen}
              options={{
                tabBarLabel: '推薦',
                tabBarIcon: ({ focused }) => <TabIcon label="推" focused={focused} />,
                tabBarItemStyle: parsedData ? {} : { display: 'none' },
              }}
            />
            <Tab.Screen
              name="BGM"
              component={BGMScreen}
              options={{
                tabBarLabel: 'BGM',
                tabBarIcon: ({ focused }) => <TabIcon label="楽" focused={focused} />,
                tabBarItemStyle: parsedData ? {} : { display: 'none' },
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AppContext.Provider>
  )
}

const styles = StyleSheet.create({
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconFocused: {
    backgroundColor: 'rgba(192,57,43,0.2)',
  },
  iconText: {
    fontSize: 16,
    fontWeight: '700',
  },
})
